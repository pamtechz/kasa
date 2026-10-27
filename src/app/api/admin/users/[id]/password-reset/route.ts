import {adminAuth,db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,sameOrigin,audit} from '@/lib/security';

export const runtime='nodejs';
const COOLDOWN_MS=15*60*1000;

/** Super-admin initiated password recovery; the secret reset link goes only
 * through Firebase's email template to the account owner's registered email.
 * Never disclose it to an administrator or put a password in logs/Firestore.
 */
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin']);
  const {id:uid}=await params;
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid))
   throw new HttpError(400,'Invalid account ID.');
  if(uid===actor.uid)throw new HttpError(403,'Use your own account recovery process.');
  const profileRef=db.collection('profiles').doc(uid);
  const p=await profileRef.get();
  if(!p.exists)throw new HttpError(404,'Account not found.');
  const profile=p.data()!;
  if(profile.role==='super_admin')throw new HttpError(403,'Another super administrator must manage their own recovery.');
  const user=await adminAuth.getUser(uid).catch(()=>null);
  if(!user||!user.email||!profile.email||user.email.toLowerCase()!==String(profile.email).toLowerCase())
   throw new HttpError(409,'Account email and verified identity do not match. Resolve identity records before sending recovery.');
  if(user.disabled||profile.active!==true)
   throw new HttpError(409,'Reactivate the account before sending recovery instructions.');
  const key=process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if(!key)throw new HttpError(503,'Firebase password reset email delivery is not configured.');
  const now=Date.now();
  const guard=db.collection('adminPasswordResetRequests').doc(uid);
  // Atomically throttle concurrent super-admin requests per recipient.
  await db.runTransaction(async tx=>{
   const prior=await tx.get(guard);
   if(prior.exists&&Number(prior.data()?.requestedAtMs)>now-COOLDOWN_MS)
    throw new HttpError(429,'A reset was already requested for this account within 15 minutes.');
   tx.set(guard,{requestedAtMs:now,requestedBy:actor.uid,updatedAt:new Date(now).toISOString()});
  });
  let sent=false;
  try{
   const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key='+encodeURIComponent(key),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requestType:'PASSWORD_RESET',email:user.email}),
    signal:AbortSignal.timeout(10000),cache:'no-store'
   });
   sent=response.ok;
  }catch{/* Do not expose provider response or credentials. */}
  if(!sent){
   await audit(actor.uid,'user.password_reset_delivery_failed',uid,{method:'firebase_email'}).catch(()=>{});
   throw new HttpError(502,'Unable to request a reset email. Check Firebase email delivery settings and retry later.');
  }
  await audit(actor.uid,'user.password_reset_requested',uid,{method:'firebase_email'});
  return json({ok:true,message:'Password reset instructions were requested for the account email. The user completes the reset privately.'});
 }catch(e){return fail(e);}
}
