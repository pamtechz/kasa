import {db} from '@/lib/firebase-admin';
import {operator,sameOrigin,audit} from '@/lib/security';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  sameOrigin(req);const actor=await operator(req,['super_admin','admin']);
  const {fileId}=await req.json();
  if(typeof fileId!=='string'||!/^[a-f0-9-]{36}$/i.test(fileId))throw new HttpError(400,'Choose a completed PDF.');
  const file=(await db.collection('r2Files').doc(fileId).get()).data();
  if(!file||file.ownerUid!==actor.uid||file.status!=='ready'||file.purpose!=='enrollment-pdf'||file.contentType!=='application/pdf'||file.connectionId==='platform')
   throw new HttpError(403,'Choose your own verified external enrollment PDF.');
  const enrollmentForm={downloadType:'upload',url:'r2asset:'+fileId,fileName:file.fileName,fileSize:file.byteSize,uploadedAt:new Date().toISOString()};
  await db.collection('settings').doc('acceptanceLetter').set({enrollmentForm,updatedBy:actor.uid,updatedAt:new Date().toISOString()},{merge:true});
  await audit(actor.uid,'settings.enrollment_pdf.attached','acceptanceLetter',{fileId});
  return json({ok:true,enrollmentForm});
 }catch(e){return fail(e);}
}
