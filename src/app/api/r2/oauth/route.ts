import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import {storageIdentity} from '@/lib/r2-storage';
import {oauthConfig} from '@/lib/r2-oauth';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const {uid}=await storageIdentity(req);
  const configured=Boolean(oauthConfig());
  const doc=await db.collection('r2OAuthSessions').doc(uid).get();
  const data=doc.data();
  return json({available:configured,connected:configured&&data?.status==='connected',
   selectedBucket:data?.status==='connected'&&data.accountId&&data.bucket?
    {accountId:data.accountId,bucket:data.bucket,jurisdiction:data.jurisdiction}:null});
 }catch(e){return fail(e);}
}
