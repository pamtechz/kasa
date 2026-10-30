import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {db} from './firebase-admin';
import {HttpError} from './errors';
import {cloudflareBearer,CLOUD_API,cloudflareApi} from './r2-oauth';
import {encryptR2Secrets,decryptR2Secrets} from './r2-crypto';
import {validateR2Address,type R2Credentials,type R2Jurisdiction} from './r2-signing';

type Target={accountId:string;bucket:string;jurisdiction:R2Jurisdiction};
/** Only metadata/control requests use KASA. Object bytes use the S3 endpoint. */
export async function oauthControl(uid:string,path:string,method:'POST'|'PUT'|'DELETE',body?:unknown){
 if(!/^\/accounts\/[a-f0-9]{32}\/(?:tokens(?:\/[a-f0-9]{32})?|r2\/buckets(?:\/[a-z0-9.-]{3,63}(?:\/cors)?)?)$/.test(path))
  throw new HttpError(400,'Invalid Cloudflare control operation.');
 const bearer=await cloudflareBearer(uid);
 const response=await fetch(CLOUD_API+path,{method,headers:{Authorization:'Bearer '+bearer,
  'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.success!==true)throw new HttpError(422,
  'Cloudflare did not approve storage setup. Reconnect with R2 storage and Account API Token Provisioning permissions.');
 return data;
}
export async function prepareOAuthBucket(uid:string,target:Target,origin:string){
 validateR2Address(target.accountId,target.bucket,target.jurisdiction);
 const base='/accounts/'+target.accountId+'/r2/buckets/'+target.bucket;
 await cloudflareApi(uid,base,{'cf-r2-jurisdiction':target.jurisdiction});
 // Merge a named rule, preserving the bucket owner's unrelated CORS rules.
 const bearer=await cloudflareBearer(uid);
 const response=await fetch(CLOUD_API+base+'/cors',{headers:{Authorization:'Bearer '+bearer,'cf-r2-jurisdiction':target.jurisdiction},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok&&response.status!==404)throw new HttpError(422,'Cloudflare did not approve bucket configuration access.');
 const existing=response.status===404?{result:{rules:[]}}:await response.json();
 const ruleId='kasa-'+createHash('sha256').update(origin).digest('hex').slice(0,16);
 const rules=Array.isArray(existing.result?.rules)?existing.result.rules:[];
 const cors={rules:[...rules.filter((r:{id?:string})=>r.id!==ruleId),{id:ruleId,
  allowed:{origins:[origin],methods:['GET','HEAD','PUT'],headers:['Content-Type','If-None-Match']},
  exposeHeaders:['ETag'],maxAgeSeconds:3600}]};
 // Jurisdiction header is required for bucket configuration as well as object operations.
 const result=await fetch(CLOUD_API+base+'/cors',{method:'PUT',headers:{Authorization:'Bearer '+bearer,
  'Content-Type':'application/json','cf-r2-jurisdiction':target.jurisdiction},body:JSON.stringify(cors),
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!result.ok)throw new HttpError(422,'Cloudflare did not permit browser access to this bucket. Approve R2 configuration permission and try again.');
 const previous=await db.collection('r2Connections').where('ownerUid','==',uid).limit(100).get();
 const match=previous.docs.find(d=>d.data().auth==='oauth'&&d.data().accountId===target.accountId&&d.data().bucket===target.bucket&&d.data().jurisdiction===target.jurisdiction);
 const id=match?.id||randomUUID(),now=new Date().toISOString();
 await db.runTransaction(async tx=>{
  const session=(await tx.get(db.collection('r2OAuthSessions').doc(uid))).data();
  if(session?.status!=='connected')throw new HttpError(409,'Cloudflare was disconnected during setup.');
  tx.set(db.collection('r2Connections').doc(id),{ownerUid:uid,...target,label:'My Cloudflare storage',
   auth:'oauth',status:'active',createdAt:match?.data().createdAt||now,updatedAt:now});
 });
 try{await oauthR2Credentials(uid,id,target);}catch(e){if(!match)await db.collection('r2Connections').doc(id).delete();throw e;}
 return id;
}
/** OAuth-created tokens are bucket scoped, short lived and never returned to clients.
 * Cloudflare added OAuth Account API token provisioning on 1 October 2026.
 * Token creation is capped by the user's membership and approved OAuth scopes.
 */
export async function oauthR2Credentials(uid:string,connectionId:string,target:Target):Promise<R2Credentials>{
 validateR2Address(target.accountId,target.bucket,target.jurisdiction);
 const sessionRef=db.collection('r2OAuthSessions').doc(uid);
 const session=(await sessionRef.get()).data();
 if(session?.status!=='connected')throw new HttpError(409,'Authorize your Cloudflare storage to continue.');
 // Revalidate the provider grant before issuing capabilities, even with cached S3 keys.
 await cloudflareApi(uid,'/accounts/'+target.accountId+'/r2/buckets/'+target.bucket,
  {'cf-r2-jurisdiction':target.jurisdiction});
 const ref=db.collection('r2ConnectionSecrets').doc(connectionId),stored=(await ref.get()).data();
 if(stored?.ownerUid===uid&&stored.encrypted&&stored.authorizedAt===session.connectedAt&&Number(stored.expiresAt)>Date.now()+300000)
  return {...target,...decryptR2Secrets(connectionId,String(stored.encrypted))};
 const response=await cloudflareApi(uid,'/accounts/'+target.accountId+'/tokens/permission_groups');
 const groups=await response.json();
 const group=(Array.isArray(groups.result)?groups.result:[]).find((g:{id?:string;name?:string})=>
  g.name==='Workers R2 Storage Bucket Item Write'&&/^[a-f0-9]{32}$/.test(g.id||''));
 if(!group)throw new HttpError(422,'Cloudflare did not grant permission to provision access to this R2 bucket.');
 const expiresAt=Date.now()+60*60*1000;
 const created=await oauthControl(uid,'/accounts/'+target.accountId+'/tokens','POST',{
  name:'KASA direct files '+connectionId.slice(0,8),expires_on:new Date(expiresAt).toISOString(),
  policies:[{effect:'allow',permission_groups:[{id:group.id}],resources:{
   ['com.cloudflare.edge.r2.bucket.'+target.accountId+'_'+target.jurisdiction+'_'+target.bucket]:'*'
  }}]});
 const token=created.result;
 if(!/^[a-f0-9]{32}$/.test(token?.id||'')||typeof token?.value!=='string'||token.value.length<40)
  throw new HttpError(502,'Cloudflare returned an invalid scoped storage credential.');
 const credentials={accessKeyId:token.id,secretAccessKey:createHash('sha256').update(token.value).digest('hex')};
 try{
  await db.runTransaction(async tx=>{
   const current=(await tx.get(sessionRef)).data();
   const connection=(await tx.get(db.collection('r2Connections').doc(connectionId))).data();
   if(current?.status!=='connected'||current.connectedAt!==session.connectedAt||connection?.status!=='active')
    throw new HttpError(409,'Cloudflare was disconnected during setup.');
   tx.set(ref,{ownerUid:uid,authorizedAt:session.connectedAt,encrypted:encryptR2Secrets(connectionId,credentials),expiresAt,
    updatedAt:new Date().toISOString()});
  });
 }catch(e){await oauthControl(uid,'/accounts/'+target.accountId+'/tokens/'+token.id,'DELETE').catch(()=>{});throw e;}
 return {...target,...credentials};
}
