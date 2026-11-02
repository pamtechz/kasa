import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import {storageIdentity} from '@/lib/r2-storage';
import {oauthConfig} from '@/lib/r2-oauth';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  // First-time public applicants do not have an OAuth/guest cookie yet.
  // Report a disconnected state without querying private sessions or logging a 401.
  // Valid bearer users and established guest sessions still use storageIdentity.
  if(!req.headers.get('authorization')){
   const {guestStorageIdentity}=await import('@/lib/r2-guest');
   if(!await guestStorageIdentity(req))
    return json({available:Boolean(oauthConfig()),connected:false,connectionId:null,selectedBucket:null});
  }
  const {uid}=await storageIdentity(req);
  const configured=Boolean(oauthConfig());
  const doc=await db.collection('r2OAuthSessions').doc(uid).get();
  const data=doc.data();
  const connection=data?.connectionId?(await db.collection('r2Connections').doc(data.connectionId).get()).data():null;
  return json({available:configured,connected:configured&&data?.status==='connected',
   connectionId:configured&&data?.status==='connected'&&connection?.status==='active'&&connection.ownerUid===uid?data.connectionId:null,
   selectedBucket:data?.status==='connected'&&data.accountId&&data.bucket?
    {accountId:data.accountId,bucket:data.bucket,jurisdiction:data.jurisdiction}:null});
 }catch(e){return fail(e);}
}
