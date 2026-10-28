import 'server-only';
import {adminAuth,db} from '@/lib/firebase-admin';
import {HttpError} from '@/lib/errors';
import type {Profile} from '@/lib/types';
import {canUseUnverifiedProvisionedAccount} from '@/lib/provisioned-sign-in';
import {decryptR2Secrets} from './r2-crypto';
import {signR2Url,type R2Credentials,type R2Jurisdiction} from './r2-signing';

export type StorageIdentity={uid:string;profile:Profile};
export async function storageIdentity(req:Request):Promise<StorageIdentity>{
 const h=req.headers.get('authorization')||'';
 if(!h.startsWith('Bearer '))throw new HttpError(401,'Sign in to upload or download files.');
 let token;
 try{token=await adminAuth.verifyIdToken(h.slice(7),true);}
 catch{throw new HttpError(401,'Sign-in session expired.');}
 const snap=await db.collection('profiles').doc(token.uid).get();
 const p=snap.data() as Profile|undefined;
 if(!p||p.active!==true)throw new HttpError(403,'Active KASA account required.');
 if(!token.email_verified&&!canUseUnverifiedProvisionedAccount(p,token.email))throw new HttpError(403,'Verify your email before using storage.');
 return {uid:token.uid,profile:p};
}
export type R2Connection={ownerUid:string;accountId:string;bucket:string;jurisdiction:R2Jurisdiction;label:string;status:'active'|'disconnected';createdAt:string;updatedAt:string};
export function platformR2():R2Credentials|null{
 const accountId=process.env.R2_PLATFORM_ACCOUNT_ID||'';
 const bucket=process.env.R2_PLATFORM_BUCKET||'';
 const accessKeyId=process.env.R2_PLATFORM_ACCESS_KEY_ID||'';
 const secretAccessKey=process.env.R2_PLATFORM_SECRET_ACCESS_KEY||'';
 if(!accountId||!bucket||!accessKeyId||!secretAccessKey)return null;
 return {accountId,bucket,accessKeyId,secretAccessKey,
  jurisdiction:(process.env.R2_PLATFORM_JURISDICTION||'default') as R2Jurisdiction};
}
export async function resolveR2(ownerUid:string,connectionId:string,allowDisconnected=false):Promise<R2Credentials>{
 if(connectionId==='platform'){
  const platform=platformR2();
  if(!platform)throw new HttpError(503,'KASA R2 storage is not configured. Connect your own R2 bucket or ask an administrator.');
  return platform;
 }
 if(!/^[0-9a-f-]{36}$/i.test(connectionId))throw new HttpError(400,'Invalid storage connection.');
 const ref=db.collection('r2Connections').doc(connectionId);
 const doc=await ref.get();const config=doc.data() as R2Connection|undefined;
 if(!config||config.ownerUid!==ownerUid||(!allowDisconnected&&config.status!=='active'))
  throw new HttpError(403,'Bucket connection is unavailable or no longer active.');
 const secret=await db.collection('r2ConnectionSecrets').doc(connectionId).get();
 if(!secret.data()?.encrypted)throw new HttpError(410,'Bucket credentials were removed by their owner. Reconnect to restore access.');
 return {...config,...decryptR2Secrets(connectionId,String(secret.data()?.encrypted))};
}
export async function signedR2Read(ownerUid:string,connectionId:string,key:string){
 const config=await resolveR2(ownerUid,connectionId,true);
 return signR2Url(config,'GET',key,90);
}
