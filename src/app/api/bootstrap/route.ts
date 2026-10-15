import {adminAuth,db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sameOrigin,requireAppCheck,rateLimit,audit} from '@/lib/security';
import type {NextRequest} from 'next/server';
export const runtime='nodejs';
/** One-time first-admin bootstrap. Only the verified email explicitly allowlisted in Vercel can claim it. */
export async function POST(req:NextRequest){
 try{
  sameOrigin(req);await requireAppCheck(req);await rateLimit(req,'bootstrap-admin',3,15);
  const allowlisted=(process.env.BOOTSTRAP_ADMIN_EMAIL||'').trim().toLowerCase();
  if(!allowlisted)throw new HttpError(503,'Initial administrator email is not configured.');
  const bearer=req.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))throw new HttpError(401,'Please sign in and verify your email.');
  let user;
  try{user=await adminAuth.verifyIdToken(bearer.slice(7),true);}catch{throw new HttpError(401,'Please sign in again.');}
  if(!user.email_verified||user.email?.toLowerCase()!==allowlisted)throw new HttpError(403,'Only the nominated, email-verified first administrator can initialize the workspace.');
  const claim=db.collection('settings').doc('bootstrap');
  const profile=db.collection('profiles').doc(user.uid);
  const now=new Date().toISOString();
  await db.runTransaction(async tx=>{
   const [done,old]=await Promise.all([tx.get(claim),tx.get(profile)]);
   if(done.exists){
    if(done.data()?.uid===user.uid&&old.data()?.role==='super_admin')return;
    throw new HttpError(409,'Administrator bootstrap has already been completed.');
   }
   if(old.exists&&old.data()?.role==='agent')throw new HttpError(403,'An agent cannot claim super-admin access.');
   tx.create(claim,{uid:user.uid,at:now,email:allowlisted});
   tx.set(profile,{uid:user.uid,email:allowlisted,displayName:user.name||allowlisted,role:'super_admin',active:true,updatedAt:now},{merge:true});
  });
  await audit(user.uid,'admin.bootstrapped','settings/bootstrap');
  return json({ok:true,next:'/dashboard'});
 }catch(e){return fail(e);}
}
