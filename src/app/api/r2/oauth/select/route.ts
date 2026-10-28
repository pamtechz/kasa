import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sameOrigin,audit} from '@/lib/security';
import {storageIdentity} from '@/lib/r2-storage';
import {cloudflareAccounts,cloudflareApi} from '@/lib/r2-oauth';
import {validateR2Address} from '@/lib/r2-signing';
import {prepareOAuthBucket} from '@/lib/r2-oauth-direct';
export const runtime='nodejs';
const schema=z.object({accountId:z.string().length(32),bucket:z.string().max(63),
 jurisdiction:z.enum(['default','eu','us','fedramp'])}).strict();
export async function POST(req:Request){
 try{
  sameOrigin(req);const {uid}=await storageIdentity(req);
  const parsed=schema.safeParse(await req.json().catch(()=>({})));
  if(!parsed.success)throw new HttpError(400,'Select a valid private R2 bucket.');
  const v=parsed.data;
  try{validateR2Address(v.accountId,v.bucket,v.jurisdiction);}
  catch{throw new HttpError(400,'Invalid private R2 bucket.');}
  const accounts=await cloudflareAccounts(uid);
  if(!accounts.some(a=>a.id===v.accountId))throw new HttpError(403,'Account not authorized.');
  const response=await cloudflareApi(uid,'/accounts/'+v.accountId+'/r2/buckets/'+v.bucket,
   {'cf-r2-jurisdiction':v.jurisdiction});
  const data=await response.json().catch(()=>({})) as {success?:boolean;result?:{name?:string}};
  if(data.success!==true||data.result?.name!==v.bucket)throw new HttpError(422,'Cloudflare did not authorize the selected bucket.');
  const connectionId=await prepareOAuthBucket(uid,v,new URL(req.url).origin);
  const ref=db.collection('r2OAuthSessions').doc(uid);
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists||snap.data()?.status!=='connected')throw new HttpError(409,'Reconnect Cloudflare to choose a bucket.');
   tx.update(ref,{connectionId,accountId:v.accountId,bucket:v.bucket,jurisdiction:v.jurisdiction,
    updatedAt:new Date().toISOString()});
  });
  await audit(uid,'r2.oauth_bucket_selected',v.bucket,{accountId:v.accountId}).catch(()=>{});
  return json({ok:true,selectedBucket:v});
 }catch(e){return fail(e);}
}
