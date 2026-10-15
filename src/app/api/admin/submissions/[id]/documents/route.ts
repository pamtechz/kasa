import type {NextRequest} from 'next/server';
import {db,storage} from '@/lib/firebase-admin';
import {operator,sameOrigin,audit,newId} from '@/lib/security';
import {loadIntake} from '@/lib/intake-server';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';
const allowed:Record<string,string>={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'};
function validMime(bytes:Buffer,mime:string){
 if(mime==='application/pdf')return bytes.subarray(0,5).toString()==='%PDF-';
 if(mime==='image/png')return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 return mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
}
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);const actor=await operator(req,['super_admin','admin','reviewer']);
  const {id}=await params,policy=await loadIntake();
  if(Number(req.headers.get('content-length')||0)>4.5*1024*1024)throw new HttpError(413,'Maximum document size is 4 MB.');
  const form=await req.formData(),kind=String(form.get('kind')||'');
  const rule=policy.cdfRequiredDocuments.find(x=>x.id===kind);
  if(!rule)throw new HttpError(400,'Select a configured CDF document type.');
  const file=form.get('file');
  if(!(file instanceof File)||!allowed[file.type]||file.size===0||file.size>4*1024*1024)throw new HttpError(400,'Upload a PDF, PNG or JPEG document under 4 MB.');
  const bytes=Buffer.from(await file.arrayBuffer());
  if(!validMime(bytes,file.type))throw new HttpError(400,'File content does not match its declared type.');
  const ref=db.collection('submissions').doc(id),record=await ref.get();
  if(!record.exists||record.data()?.formKind!=='student')throw new HttpError(404,'Student application not found.');
  if(['rejected','cdf_approved','payment_verified','commission_paid'].includes(String(record.data()?.status)))throw new HttpError(409,'Cannot modify documents for this status.');
  const path='cdf-documents/'+id+'/'+newId()+'.'+allowed[file.type];
  const obj=storage.bucket().file(path);
  await obj.save(bytes,{resumable:false,contentType:file.type,metadata:{cacheControl:'private,no-store'}});
  let replaced='';
  try{
   await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists||snap.data()?.formKind!=='student')throw new HttpError(404,'Application changed.');
    const old=snap.data()?.documents||{};
    replaced=old[kind]?.path||'';
    tx.update(ref,{['documents.'+kind]:{kind,label:rule.label,path,fileName:file.name.slice(0,150),contentType:file.type,size:file.size,uploadedBy:actor.uid,uploadedAt:new Date().toISOString(),verifiedAt:null,verifiedBy:null},updatedAt:new Date().toISOString()});
   });
  }catch(e){await obj.delete().catch(()=>{});throw e;}
  if(replaced&&replaced!==path)await storage.bucket().file(replaced).delete().catch(()=>{});
  await audit(actor.uid,'cdf_document.uploaded',id,{kind});
  return json({ok:true,kind});
 }catch(e){return fail(e);}
}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);const actor=await operator(req,['super_admin','admin','reviewer']);
  const {id}=await params,body=await req.json(),kind=String(body?.kind||'');
  if(!/^[a-z][a-z0-9-]{1,60}$/.test(kind))throw new HttpError(400,'Invalid document type.');
  const ref=db.collection('submissions').doc(id),now=new Date().toISOString();
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref),document=snap.data()?.documents?.[kind];
   if(['rejected','cdf_approved','payment_verified','commission_paid'].includes(String(snap.data()?.status)))throw new HttpError(409,'Funding documentation is locked after verification.');
   if(!snap.exists||!document?.path)throw new HttpError(404,'Document not found.');
   tx.update(ref,{['documents.'+kind+'.verifiedAt']:body?.verified===true?now:null,['documents.'+kind+'.verifiedBy']:body?.verified===true?actor.uid:null,updatedAt:now});
  });
  await audit(actor.uid,'cdf_document.verified',id,{kind,verified:body?.verified===true});
  return json({ok:true});
 }catch(e){return fail(e);}
}
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  await operator(req,['super_admin','admin','reviewer']);
  const {id}=await params,kind=new URL(req.url).searchParams.get('kind')||'';
  const doc=await db.collection('submissions').doc(id).get();
  const file=doc.data()?.documents?.[kind];
  if(!file?.path||!file.path.startsWith('cdf-documents/'+id+'/'))throw new HttpError(404,'Document not found.');
  const [url]=await storage.bucket().file(file.path).getSignedUrl({action:'read',expires:Date.now()+2*60*1000});
  return json({url,expiresInSeconds:120});
 }catch(e){return fail(e);}
}
