import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import {sameOrigin,audit} from '@/lib/security';
import {storageIdentity} from '@/lib/r2-storage';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  sameOrigin(req);const {uid}=await storageIdentity(req);
  // Immediately remove ALL locally stored OAuth tokens and selected bucket.
  await db.runTransaction(async tx=>{
   const connections=await tx.get(db.collection('r2Connections').where('ownerUid','==',uid));
   tx.delete(db.collection('r2OAuthSessions').doc(uid));
   tx.delete(db.collection('r2OAuthSecrets').doc(uid));
   for(const connection of connections.docs){
    if(connection.data().auth!=='oauth')continue;
    tx.update(connection.ref,{status:'disconnected',updatedAt:new Date().toISOString()});
    tx.delete(db.collection('r2ConnectionSecrets').doc(connection.id));
   }
  });
  await audit(uid,'r2.oauth_disconnected',uid).catch(()=>{});
  return json({ok:true});
 }catch(e){return fail(e);}
}
