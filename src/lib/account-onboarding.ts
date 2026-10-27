import 'server-only';
import {randomBytes} from 'node:crypto';
import {adminAuth,db} from '@/lib/firebase-admin';
import {HttpError} from '@/lib/errors';
import type {Profile,Role} from '@/lib/types';
import {validateInitialPassword} from '@/lib/admin-initial-password';

/** A single Auth user + a single School profile, shared by Marathon.
 * Never set emailVerified=true on an administrator's assertion.
 */
export async function ensureSchoolIdentity(input:{
 email:string;displayName?:string;schoolRole?:Role;actorUid:string;
 initialPassword?:string;requireExistingOrPassword?:boolean;
}):Promise<{uid:string;profile:Profile;authCreated:boolean;profileCreated:boolean;verificationPending:boolean;onboardingEmailSent:boolean}>{
 const email=input.email.trim().toLowerCase();
 const displayName=(input.displayName||'').trim();
 if(input.initialPassword!==undefined)validateInitialPassword(input.initialPassword);
 let user;
 let authCreated=false;
 try{user=await adminAuth.getUserByEmail(email);}
 catch(error){
  if((error as {code?:string}).code!=='auth/user-not-found')throw error;
  if(input.requireExistingOrPassword&&!input.initialPassword)
   throw new HttpError(400,'A strong initial password is required for a new Marathon-only member. Existing School accounts need no new password.');
  try{
   // Unique unshared random credential; recipient chooses their own through reset.
   user=await adminAuth.createUser({
    email,emailVerified:false,displayName:displayName||undefined,
    password:input.initialPassword||randomBytes(48).toString('base64url'),disabled:false
   });
   authCreated=true;
  }catch(createError){
   // Concurrent invite requests must reuse the same Auth UID, not create shadows.
   if((createError as {code?:string}).code!=='auth/email-already-exists')throw createError;
   user=await adminAuth.getUserByEmail(email);
  }
 }
 if(!authCreated&&input.initialPassword)
  throw new HttpError(409,'This email already has a KASA identity. Link its existing account; use the separate Set initial password editor only if credential replacement is necessary.');
 const profileRef=db.collection('profiles').doc(user.uid);
 const now=new Date().toISOString();
 const profileCreated=await db.runTransaction(async tx=>{
  const snap=await tx.get(profileRef);
  if(snap.exists){
   const existing=snap.data() as Profile;
   if(String(existing.email||'').toLowerCase()!==email)
    throw new HttpError(409,'Auth email does not match the existing KASA profile; reconcile the identity before assigning roles.');
   if(existing.active!==true)throw new HttpError(403,'School account inactive. Ask the School administrator to reactivate it.');
   return false;
  }
  const profile:Profile={
   uid:user.uid,email,displayName:displayName||user.displayName||email.split('@')[0],
   role:input.schoolRole||'student',active:true,createdAt:now,updatedAt:now
  };
  tx.create(profileRef,{...profile,createdBy:input.actorUid,
   ...(authCreated&&input.initialPassword?{adminPasswordProvisionedAt:now,mustChangePassword:true}:{})});
  return true;
 });
 const finalSnap=await profileRef.get();
 const profile=finalSnap.data() as Profile|undefined;
 if(!profile)throw new Error('Unable to load the School profile.');
 // Only email the initial password-set link when account creation was initiated
 // here, or when an unfinished provisioning action is completed by retry.
 // Do not send a password reset to existing verified accounts.
 let onboardingEmailSent=false;
 if(!input.initialPassword&&!user.emailVerified&&(authCreated||profileCreated))
  onboardingEmailSent=await sendPasswordSetupEmail(email);
 return {uid:user.uid,profile,authCreated,profileCreated,
  verificationPending:!user.emailVerified,onboardingEmailSent};
}

/** Firebase Auth sends its own configured password recovery template.
 * No reset credential or email action link passes through the KASA server
 * response or is written to Firestore.
 */
async function sendPasswordSetupEmail(email:string):Promise<boolean>{
 const key=process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
 if(!key)return false;
 try{
  const result=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key='+encodeURIComponent(key),{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({requestType:'PASSWORD_RESET',email}),
   signal:AbortSignal.timeout(8000),cache:'no-store'
  });
  return result.ok;
 }catch{return false;}
}
