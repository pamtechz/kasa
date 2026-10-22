import type {NextRequest} from 'next/server';
import {db,storage} from '@/lib/firebase-admin';
import {sameOrigin,requireAppCheck,rateLimit,audit,newId} from '@/lib/security';
import {verifiedStudent} from '@/lib/student-access';
import {loadIntake} from '@/lib/intake-server';
import {fail,json,HttpError} from '@/lib/errors';

export const runtime='nodejs';

const ALLOWED_MIME:Record<string,string>={
 'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'
};
const MAX_BYTES=4*1024*1024;
const BLOCKED_STATUSES=['rejected','cdf_approved','payment_verified','commission_paid'];

function matchesMime(bytes:Buffer,mime:string):boolean{
 if(mime==='application/pdf')return bytes.subarray(0,5).toString('ascii')==='%PDF-';
 if(mime==='image/png')return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 return mime==='image/jpeg'&&bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);
  await requireAppCheck(req);
  await rateLimit(req,'student-document-upload',8,15);
  const identity=await verifiedStudent(req);
  const {id}=await params;
  if(!/^[a-zA-Z0-9_-]{8,64}$/.test(id))throw new HttpError(400,'Invalid application ID.');
  if(Number(req.headers.get('content-length')||0)>MAX_BYTES+100000) {
   throw new HttpError(413,'Maximum file size is 4 MB.');
  }
  const form=await req.formData();
  const kind=String(form.get('kind')||'');
  const policy=await loadIntake();
  const rule=policy.cdfRequiredDocuments.find(d=>d.id===kind);
  if(!rule)throw new HttpError(400,'Select one of the required document types.');
  const file=form.get('file');
  if(!(file instanceof File) || !ALLOWED_MIME[file.type] || file.size<1 || file.size>MAX_BYTES){
   throw new HttpError(400,'Upload a PDF, PNG or JPEG document of up to 4 MB.');
  }
  const bytes=Buffer.from(await file.arrayBuffer());
  if(!matchesMime(bytes,file.type))throw new HttpError(400,'Document content does not match its file type.');
  const ref=db.collection('submissions').doc(id);
  const snapshot=await ref.get();
  if(!snapshot.exists || snapshot.data()?.applicantUid!==identity.uid ||
     snapshot.data()?.formKind!=='student')throw new HttpError(404,'Application not found.');
  if(BLOCKED_STATUSES.includes(String(snapshot.data()?.status))) {
   throw new HttpError(409,'Documents for this application are locked.');
  }
  const path=`cdf-documents/${id}/${newId()}.${ALLOWED_MIME[file.type]}`;
  const object=storage.bucket().file(path);
  await object.save(bytes,{
   resumable:false,
   contentType:file.type,
   metadata:{cacheControl:'private,no-store'}
  });
  let replaced='';
  try{
   await db.runTransaction(async tx=>{
    const current=await tx.get(ref);
    if(!current.exists || current.data()?.applicantUid!==identity.uid ||
       current.data()?.formKind!=='student'){
     throw new HttpError(403,'This application is not linked to your account.');
    }
    if(BLOCKED_STATUSES.includes(String(current.data()?.status))){
     throw new HttpError(409,'Documents for this application are locked.');
    }
    const existing=current.data()?.documents||{};
    replaced=String(existing[kind]?.path||'');
    tx.update(ref,{
     ['documents.'+kind]:{
      kind,label:rule.label,path,fileName:file.name.slice(0,150),
      contentType:file.type,size:file.size,uploadedAt:new Date().toISOString(),
      uploadedBy:identity.uid,verifiedAt:null,verifiedBy:null
     },
     updatedAt:new Date().toISOString()
    });
   });
  }catch(err){
   await object.delete().catch(()=>{});
   throw err;
  }
  if(replaced&&replaced!==path&&replaced.startsWith('cdf-documents/'+id+'/')){
   await storage.bucket().file(replaced).delete().catch(()=>{});
  }
  await audit(identity.uid,'student.document_uploaded',id,{kind});
  return json({ok:true,kind});
 }catch(err){return fail(err);}
}

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const identity=await verifiedStudent(req);
  const {id}=await params;
  if(!/^[a-zA-Z0-9_-]{8,64}$/.test(id))throw new HttpError(400,'Invalid application ID.');
  const kind=new URL(req.url).searchParams.get('kind')||'';
  if(!/^[a-z0-9_-]{2,60}$/.test(kind))throw new HttpError(400,'Invalid document type.');
  const record=await db.collection('submissions').doc(id).get();
  if(!record.exists||record.data()?.applicantUid!==identity.uid){
   throw new HttpError(404,'Application not found.');
  }
  const document=record.data()?.documents?.[kind];
  if(!document?.path || !String(document.path).startsWith('cdf-documents/'+id+'/')){
   throw new HttpError(404,'Document not found.');
  }
  const [url]=await storage.bucket().file(document.path).getSignedUrl({
   action:'read',expires:Date.now()+120000
  });
  return json({url,expiresInSeconds:120});
 }catch(err){return fail(err);}
}
