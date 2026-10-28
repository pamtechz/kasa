import {db,storage} from '@/lib/firebase-admin';
import {signedR2Read} from '@/lib/r2-storage';
import {operator,sameOrigin,audit} from '@/lib/security';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';
export async function POST(){return json({error:'Use a direct upload to your authorized external storage.',code:'DIRECT_UPLOAD_REQUIRED'},410);}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);const actor=await operator(req,['super_admin','admin','reviewer']);
  const {id}=await params,body=await req.json(),kind=String(body?.kind||'');
  if(!/^[a-z][a-z0-9-]{1,60}$/.test(kind))throw new HttpError(400,'Invalid document type.');
  const ref=db.collection('submissions').doc(id),now=new Date().toISOString();
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref),document=snap.data()?.documents?.[kind];
   if(['rejected','cdf_approved','cdf_funds_received','payment_verified','commission_paid'].includes(String(snap.data()?.status)))throw new HttpError(409,'Funding documentation is locked after verification.');
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
  if(typeof file?.r2FileId==='string'&&file.path==='r2:'+file.r2FileId){
   const snap=await db.collection('r2Files').doc(file.r2FileId).get(),asset=snap.data();
   if(!asset||asset.status!=='ready'||asset.purpose!=='cdf-document'||asset.submissionId!==id||asset.kind!==kind||(asset.connectionId!=='platform'&&asset.sharedWithKasa!==true))
    throw new HttpError(404,'R2 document unavailable.');
   return json({url:await signedR2Read(asset.ownerUid,asset.connectionId,asset.key),expiresInSeconds:90});
  }
  if(!file?.path||!file.path.startsWith('cdf-documents/'+id+'/'))throw new HttpError(404,'Document not found.');
  const [url]=await storage.bucket().file(file.path).getSignedUrl({action:'read',expires:Date.now()+2*60*1000});
  return json({url,expiresInSeconds:120});
 }catch(e){return fail(e);}
}
