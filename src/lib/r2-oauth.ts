import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {db} from './firebase-admin';
import {HttpError} from './errors';
import {encryptR2Secrets,decryptR2Secrets,r2EncryptionReady} from './r2-crypto';

export const OAUTH_COOKIE='__Host-kasa-r2-oauth';
export const OAUTH_CALLBACK='/api/r2/oauth/callback';
export const CLOUD_AUTH='https://dash.cloudflare.com/oauth2/auth';
const CLOUD_TOKEN='https://dash.cloudflare.com/oauth2/token';
export const CLOUD_API='https://api.cloudflare.com/client/v4';
const EXPIRY=8*60*1000;
type CloudTokens={access_token:string;refresh_token?:string;expires_in?:number;token_type?:string;scope?:string};
type OAuthConfig={clientId:string;clientSecret:string;scopes:string;redirectUri:string};
export function oauthConfig():OAuthConfig|null{
 const clientId=process.env.CLOUDFLARE_OAUTH_CLIENT_ID?.trim()||'';
 const clientSecret=process.env.CLOUDFLARE_OAUTH_CLIENT_SECRET?.trim()||'';
 const scopes=process.env.CLOUDFLARE_OAUTH_SCOPES?.trim().split(/\s+/).join(' ')||'';
 const redirectUri=process.env.CLOUDFLARE_OAUTH_REDIRECT_URI?.trim()||'';
 if(!clientId||!clientSecret||!scopes||!redirectUri||!r2EncryptionReady())return null;
 let url:URL;
 try{url=new URL(redirectUri);}catch{return null;}
 if(url.protocol!=='https:'||url.pathname!==OAUTH_CALLBACK||url.search||url.hash||url.username||url.password)return null;
 // The OAuth callback must be on a trusted KASA origin, never from user input.
 const appUrl=process.env.APP_URL||'';
 const vercelUrl=process.env.VERCEL_URL||'';
 const allowed=[appUrl,vercelUrl?'https://'+vercelUrl:''].filter(Boolean).some(u=>{
  try{return new URL(u).origin===url.origin;}catch{return false;}
 });
 if(!allowed)return null;
 return {clientId,clientSecret,scopes,redirectUri};
}
export const oauthStateHash=(state:string)=>createHash('sha256').update(state).digest('hex');
export const oauthRandom=()=>randomBytes(32).toString('base64url');
export const oauthChallenge=(verifier:string)=>createHash('sha256').update(verifier).digest('base64url');
export function authorizationUrl(config:OAuthConfig,state:string,challenge:string){
 const u=new URL(CLOUD_AUTH);
 for(const [k,v] of Object.entries({response_type:'code',client_id:config.clientId,
  redirect_uri:config.redirectUri,scope:config.scopes,state,
  code_challenge:challenge,code_challenge_method:'S256'}))u.searchParams.set(k,v);
 return u.toString();
}
export async function exchangeCloudflare(config:OAuthConfig,params:URLSearchParams):Promise<CloudTokens>{
 const response=await fetch(CLOUD_TOKEN,{
  method:'POST',headers:{Authorization:'Basic '+Buffer.from(config.clientId+':'+config.clientSecret).toString('base64'),
   'Content-Type':'application/x-www-form-urlencoded'},
  body:params,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)
 }).catch(()=>{throw new HttpError(502,'Cloudflare authorization is temporarily unavailable.');});
 if(!response.ok)throw new HttpError(422,'Cloudflare authorization was rejected. Reconnect your account.');
 const data=await response.json().catch(()=>({})) as CloudTokens;
 if(data.token_type?.toLowerCase()!=='bearer'||typeof data.access_token!=='string'||data.access_token.length<10)
  throw new HttpError(502,'Cloudflare returned an invalid authorization.');
 return data;
}
export async function saveOAuthSession(uid:string,tokens:CloudTokens){
 if(!tokens.refresh_token)throw new HttpError(422,'Cloudflare did not grant refresh access. Review the application permissions.');
 const now=Date.now(),encrypted=encryptR2Secrets('cloudflare-oauth:'+uid,{
  accessKeyId:tokens.access_token,secretAccessKey:tokens.refresh_token});
 const batch=db.batch();
 batch.set(db.collection('r2OAuthSessions').doc(uid),{
  ownerUid:uid,status:'connected',bucket:null,accountId:null,jurisdiction:null,
  scope:typeof tokens.scope==='string'?tokens.scope.slice(0,500):'',
  connectedAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()
 });
 batch.set(db.collection('r2OAuthSecrets').doc(uid),{ownerUid:uid,encrypted,
  expiresAt:now+Math.max(30,Math.min(86400,Number(tokens.expires_in)||3600))*1000,
  updatedAt:new Date(now).toISOString()});
 await batch.commit();
}
export async function cloudflareBearer(uid:string):Promise<string>{
 const config=oauthConfig();if(!config)throw new HttpError(503,'Cloudflare sign-in is not configured.');
 const ref=db.collection('r2OAuthSecrets').doc(uid),doc=await ref.get(),d=doc.data();
 if(!d?.encrypted||d.ownerUid!==uid)throw new HttpError(409,'Connect your Cloudflare account first.');
 const current=decryptR2Secrets('cloudflare-oauth:'+uid,String(d.encrypted));
 if(Number(d.expiresAt)>Date.now()+90000)return current.accessKeyId;
 if(!current.secretAccessKey)throw new HttpError(401,'Reconnect Cloudflare to restore access.');
 const params=new URLSearchParams({grant_type:'refresh_token',refresh_token:current.secretAccessKey});
 let tokens:CloudTokens;
 try{tokens=await exchangeCloudflare(config,params);}
 catch(e){
  const recent=(await ref.get()).data();
  if(recent?.encrypted&&recent.encrypted!==d.encrypted&&Number(recent.expiresAt)>Date.now()+90000)
   return decryptR2Secrets('cloudflare-oauth:'+uid,String(recent.encrypted)).accessKeyId;
  throw e;
 }
 const encrypted=encryptR2Secrets('cloudflare-oauth:'+uid,{
  accessKeyId:tokens.access_token,secretAccessKey:tokens.refresh_token||current.secretAccessKey});
 // Only the owner has access to this document; never send tokens to the browser.
 await ref.set({ownerUid:uid,encrypted,expiresAt:Date.now()+Math.max(30,Math.min(86400,Number(tokens.expires_in)||3600))*1000,
  updatedAt:new Date().toISOString()});
 return tokens.access_token;
}
export async function cloudflareApi(uid:string,path:string,headers:Record<string,string>={}):Promise<Response>{
 // No arbitrary external URL is accepted. Every call stays on the Cloudflare REST API.
 if(!path.startsWith('/')||path.includes('..')||path.includes('\\')||path.includes('//'))
  throw new HttpError(400,'Invalid Cloudflare API path.');
 const token=await cloudflareBearer(uid);
 const response=await fetch(CLOUD_API+path,{headers:{...headers,Authorization:'Bearer '+token},
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
 if(response.status===401||response.status===403)
  throw new HttpError(403,'Cloudflare did not authorize this R2 operation. Check the approved OAuth permissions.');
 if(!response.ok)throw new HttpError(502,'Cloudflare storage is temporarily unavailable.');
 return response;
}
export async function cloudflareAccounts(uid:string):Promise<{id:string;name:string}[]>{
 const response=await cloudflareApi(uid,'/accounts?per_page=50');
 const data=await response.json().catch(()=>({})) as {success?:boolean;result?:Array<{id?:string;name?:string}>};
 if(data.success!==true||!Array.isArray(data.result))throw new HttpError(502,'Unable to read authorized Cloudflare accounts.');
 return data.result.filter(a=>/^[a-f0-9]{32}$/i.test(a.id||'')).map(a=>({id:a.id!,name:String(a.name||'Cloudflare account').slice(0,150)}));
}
export function oauthStateExpires(){return Date.now()+EXPIRY;}
