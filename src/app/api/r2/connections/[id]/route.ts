import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sameOrigin,audit} from '@/lib/security';
import {storageIdentity} from '@/lib/r2-storage';
export const runtime='nodejs';
/** Disconnect destroys stored secrets; existing objects remain in the customer's bucket.
 * The application cannot read them until the owner reconnects (new connection ID).
 */
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);const {uid}=await storageIdentity(req);const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new HttpError(400,'Invalid R2 connection ID.');
  const body=await req.json().catch(()=>({}));
  if(body.confirm!==true)throw new HttpError(400,'Explicitly confirm disconnecting this bucket.');
  const ref=db.collection('r2Connections').doc(id),secret=db.collection('r2ConnectionSecrets').doc(id);
  await db.runTransaction(async tx=>{
   const data=await tx.get(ref);if(!data.exists||data.data()?.ownerUid!==uid)throw new HttpError(404,'Bucket connection not found.');
   tx.update(ref,{status:'disconnected',updatedAt:new Date().toISOString()});
   tx.delete(secret);
  });
  await audit(uid,'r2.bucket_disconnected',id,{}).catch(()=>{});
  return json({ok:true,message:'Bucket disconnected. Stored objects were not deleted. Credentials are destroyed; existing files cannot be opened until migrated or separately restored.'});
 }catch(e){return fail(e);}
}
