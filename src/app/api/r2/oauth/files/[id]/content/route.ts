import {db} from '@/lib/firebase-admin';
import {fail,HttpError} from '@/lib/errors';
import {storageIdentity,signedR2Read,resolveR2} from '@/lib/r2-storage';
export const runtime='nodejs';
/** Authenticated REST proxy: an OAuth bearer token never reaches the browser.
 * A staff member must have an explicit active owner-issued KASA grant.
 */
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {uid,profile}=await storageIdentity(req),{id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new HttpError(400,'Invalid file.');
  const doc=await db.collection('r2Files').doc(id).get(),file=doc.data();
  if(!file||file.status!=='ready'||file.connectionId!=='oauth'||file.purpose!=='personal-document')
   throw new HttpError(404,'Private file not found.');
  if(file.ownerUid!==uid){
   if(!['super_admin','admin','reviewer'].includes(profile.role)||file.sharedWithKasa!==true)
    throw new HttpError(403,'Owner has not granted KASA access.');
   const share=await db.collection('r2InstitutionShares').doc(id).get();
   if(!share.exists||share.data()?.ownerUid!==file.ownerUid)
    throw new HttpError(403,'KASA document access was revoked.');
  }
  const target=await resolveR2(file.ownerUid,'oauth');
  if(target.accountId!==file.accountId||target.bucket!==file.bucket||target.jurisdiction!==file.jurisdiction)
   throw new HttpError(409,'Reconnect the original external bucket to open this file.');
  return Response.redirect(await signedR2Read(file.ownerUid,'oauth',file.key),307);
 }catch(e){return fail(e);}
}
