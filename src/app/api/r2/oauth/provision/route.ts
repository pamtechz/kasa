import {createHash} from 'node:crypto';
import {db} from '@/lib/firebase-admin';
import {storageIdentity} from '@/lib/r2-storage';
import {sameOrigin} from '@/lib/security';
import {cloudflareAccounts,cloudflareApi} from '@/lib/r2-oauth';
import {oauthControl,prepareOAuthBucket} from '@/lib/r2-oauth-direct';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  sameOrigin(req);const {uid}=await storageIdentity(req);
  const body=await req.json().catch(()=>({})),accounts=await cloudflareAccounts(uid);
  if(!accounts.length)throw new HttpError(422,'Cloudflare did not authorize an account.');
  if(accounts.length>1&&!body.accountId)return json({accounts});
  const accountId=body.accountId||accounts[0].id;
  if(!accounts.some(a=>a.id===accountId))throw new HttpError(403,'Choose an authorized Cloudflare account.');
  const bucket='kasa-files-'+createHash('sha256').update(uid).digest('hex').slice(0,20);
  const list=await cloudflareApi(uid,'/accounts/'+accountId+'/r2/buckets?per_page=100');
  const data=await list.json();
  if(!Array.isArray(data.result?.buckets))throw new HttpError(502,'Unable to read your Cloudflare storage.');
  if(!data.result.buckets.some((b:{name?:string})=>b.name===bucket))
   await oauthControl(uid,'/accounts/'+accountId+'/r2/buckets','POST',{name:bucket});
  const target={accountId,bucket,jurisdiction:'default' as const};
  const connectionId=await prepareOAuthBucket(uid,target,new URL(req.url).origin);
  const sessionRef=db.collection('r2OAuthSessions').doc(uid);
  await db.runTransaction(async tx=>{
   const session=await tx.get(sessionRef);
   if(session.data()?.status!=='connected')throw new HttpError(409,'Cloudflare was disconnected during setup.');
   tx.update(sessionRef,{...target,connectionId,updatedAt:new Date().toISOString()});
  });
  return json({ok:true,connectionId,selectedBucket:target});
 }catch(e){return fail(e);}
}
