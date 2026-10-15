import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {adminAuth,appCheck,db} from './firebase-admin';
import {HttpError} from './errors';
import type {Profile,Role} from './types';
const operatorRoles:Role[]=['super_admin','admin','reviewer'];
export async function operator(req:Request, allowed:Role[]=operatorRoles):Promise<Profile>{
 const value=req.headers.get('authorization')||'';
 if(!value.startsWith('Bearer ')) throw new HttpError(401,'Authentication required.');
 let uid='';
 try{const token=await adminAuth.verifyIdToken(value.slice(7),true);if(!token.email_verified)throw Error('Email not verified');uid=token.uid;}
 catch {throw new HttpError(401,'Session expired. Sign in again.');}
 const snapshot=await db.collection('profiles').doc(uid).get();
 const p=snapshot.data() as Profile|undefined;
 if(!p || !p.active || !allowed.includes(p.role)) throw new HttpError(403,'Access denied.');
 return {...p,uid};
}
export function sameOrigin(req:Request){
 const origin=req.headers.get('origin');
 const allowed=[process.env.APP_URL,process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:undefined].filter(Boolean).map(v=>new URL(v!).origin);
 if(!origin || !allowed.includes(new URL(origin).origin))
  throw new HttpError(403,'Invalid request origin.');
}
export async function requireAppCheck(req:Request){
 if(process.env.NODE_ENV!=='production') return;
 const token=req.headers.get('x-firebase-appcheck');
 if(!token) throw new HttpError(403,'Application verification is required.');
 try {const verified=await appCheck.verifyToken(token,{consume:true});
  if(verified.alreadyConsumed) throw new Error('Token already used');}
 catch {throw new HttpError(403,'Application verification failed.');}
}
export function digest(raw:string){
 const salt=process.env.RATE_LIMIT_SALT;
 if(!salt || salt.length<32) throw new Error('RATE_LIMIT_SALT must contain at least 32 characters');
 return createHash('sha256').update(`${salt}:${raw}`).digest('hex');
}
export async function rateLimit(req:NextRequest,prefix:string,max=8,minutes=10){
 const ip=req.headers.get('x-vercel-forwarded-for')?.split(',')[0] || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
 const slot=Math.floor(Date.now()/(minutes*60000));
 const ref=db.collection('rateLimits').doc(digest(`${prefix}:${ip}:${slot}`));
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  const count=Number(snap.data()?.count||0);
  if(count>=max) throw new HttpError(429,'Too many requests. Try again later.');
  tx.set(ref,{count:count+1,expiresAt: new Date(Date.now()+60*60*1000)},{merge:true});
 });
}
export function newId(){return randomUUID();}
export function safeText(x:unknown,max=400){return typeof x==='string'?x.trim().slice(0,max):'';}
export async function audit(actor:string,action:string,target:string,details:Record<string,unknown>={}){
 await db.collection('auditLogs').add({actor,action,target,details,at:new Date().toISOString()});
}
