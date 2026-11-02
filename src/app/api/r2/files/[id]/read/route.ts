import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {storageIdentity,signedR2Read,legacyOAuthReadUrl} from '@/lib/r2-storage';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {uid}=await storageIdentity(req);const {id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new HttpError(400,'Invalid file identifier.');
  const doc=await db.collection('r2Files').doc(id).get(),file=doc.data();
  if(!file||file.status!=='ready')throw new HttpError(404,'File unavailable.');
  if(file.ownerUid!==uid&&!(Array.isArray(file.sharedWith)&&file.sharedWith.includes(uid)))
   throw new HttpError(403,'File access denied.');
  const url=file.connectionId==='oauth'?await legacyOAuthReadUrl(file):await signedR2Read(file.ownerUid,file.connectionId,file.key);
  return json({url,expiresInSeconds:90,fileName:file.fileName,contentType:file.contentType,
   visibility:file.visibility,provider:'cloudflare-r2'});
 }catch(e){return fail(e);}
}
