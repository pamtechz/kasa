import {db} from '@/lib/firebase-admin';
import {fail,HttpError} from '@/lib/errors';
import {storageIdentity} from '@/lib/r2-storage';
import {authorizedOAuthObject} from '@/lib/r2-oauth';
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
  // Object path is generated and verified by our server; never accept a client path.
  const response=await authorizedOAuthObject(file.ownerUid,'GET',{
   accountId:file.accountId,bucket:file.bucket,jurisdiction:file.jurisdiction},file.key);
  const allowed=['image/png','image/jpeg','application/pdf'];
  if(!allowed.includes(file.contentType))throw new HttpError(403,'Document type not allowed.');
  const name=String(file.fileName||'document').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100);
  return new Response(response.body,{status:200,headers:{
   'Content-Type':file.contentType,'Content-Disposition':'attachment; filename="'+name+'"',
   'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'
  }});
 }catch(e){return fail(e);}
}
