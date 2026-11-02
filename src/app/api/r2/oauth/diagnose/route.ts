import {randomUUID} from 'node:crypto';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sameOrigin,rateLimit} from '@/lib/security';
import {storageIdentity,resolveR2} from '@/lib/r2-storage';
import {signR2Url} from '@/lib/r2-signing';
export const runtime='nodejs';

/** End-to-end test of live OAuth + bucket credentials with zero file uploads.
 * R2 should return 404 for a random object name. It cannot prove browser PUT
 * or CORS; those still require an explicit user-authorized upload test.
 */
export async function POST(req:Request){
 try{
  sameOrigin(req);const {uid}=await storageIdentity(req);
  await rateLimit(req,'r2-diagnose:'+uid,4,10);
  const session=(await db.collection('r2OAuthSessions').doc(uid).get()).data();
  const id=String(session?.connectionId||'');
  if(!/^[0-9a-f-]{36}$/i.test(id)||session?.status!=='connected')
   throw new HttpError(409,'Connect your Cloudflare account before testing storage.');
  const connection=(await db.collection('r2Connections').doc(id).get()).data();
  if(!connection||connection.ownerUid!==uid||connection.status!=='active'||connection.auth!=='oauth')
   throw new HttpError(409,'Your Cloudflare storage connection is not active.');
  const bucket=await resolveR2(uid,id);
  const url=signR2Url(bucket,'HEAD','private/'+uid+'/_kasa-diagnostic/'+randomUUID(),30);
  const response=await fetch(url,{method:'HEAD',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)})
   .catch(()=>{throw new HttpError(502,'Cloudflare R2 did not respond to the storage test.');});
  if(response.status===404)
   return json({ok:true,code:'r2-signed-read-verified',message:'Cloudflare account, private bucket and signed R2 access verified. No test file was uploaded. Please complete a normal direct-upload test as well.'});
  if(response.status===401||response.status===403)
   throw new HttpError(403,'Cloudflare denied the signed storage request. Reconnect Cloudflare or check the token provisioning and bucket permissions.');
  throw new HttpError(502,'R2 returned an unexpected response. Check your Cloudflare storage permissions and retry.');
 }catch(e){return fail(e);}
}
