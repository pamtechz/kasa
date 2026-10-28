import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator} from '@/lib/security';
import {signedR2Read,legacyOAuthReadUrl} from '@/lib/r2-storage';
export const runtime='nodejs';
/** Staff can open explicitly user-consented individual documents, not buckets. */
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  await operator(req,['super_admin','admin','reviewer']);
  const {id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new HttpError(400,'Invalid file identifier.');
  const [grantDoc,fileDoc]=await Promise.all([
   db.collection('r2InstitutionShares').doc(id).get(),
   db.collection('r2Files').doc(id).get()
  ]);
  const grant=grantDoc.data(),file=fileDoc.data();
  if(!grant||!file||grant.ownerUid!==file.ownerUid||file.status!=='ready'||
     file.sharedWithKasa!==true||file.purpose!=='personal-document')
   throw new HttpError(404,'This document has not been shared with KASA.');
  // The owner can disconnect the bucket; reads then fail closed.
  const url=file.connectionId==='oauth'?await legacyOAuthReadUrl(file):await signedR2Read(file.ownerUid,file.connectionId,file.key);
  return json({url,expiresInSeconds:90,fileName:file.fileName,contentType:file.contentType});
 }catch(e){return fail(e);}
}
