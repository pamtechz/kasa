import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import {sameOrigin,audit} from '@/lib/security';
import {storageIdentity} from '@/lib/r2-storage';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  sameOrigin(req);const {uid}=await storageIdentity(req);
  // Immediately remove ALL locally stored OAuth tokens and selected bucket.
  const batch=db.batch();
  batch.delete(db.collection('r2OAuthSessions').doc(uid));
  batch.delete(db.collection('r2OAuthSecrets').doc(uid));
  await batch.commit();
  await audit(uid,'r2.oauth_disconnected',uid).catch(()=>{});
  return json({ok:true});
 }catch(e){return fail(e);}
}
