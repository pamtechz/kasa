import 'server-only';
import {adminAuth,db} from '@/lib/firebase-admin';
import {audit} from '@/lib/security';
import {HttpError} from '@/lib/errors';
import type {Profile} from '@/lib/types';

export function validateInitialPassword(password:unknown):asserts password is string{
 if(typeof password!=='string'||password.length<12||password.length>128||
  !/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||
  !/[^A-Za-z0-9]/.test(password)||/\s/.test(password)||
  ['password','123456','qwerty','kasa','welcome'].some(part=>password.toLowerCase().includes(part)))
  throw new HttpError(400,'Initial password must be 12–128 characters with uppercase, lowercase, number and symbol; avoid common passwords and spaces.');
}

/** This is the ONLY admin-controlled password setter. Caller must establish
 * global super_admin authorization, never a secondary Marathon role.
 * Never persist, log or return the plaintext password.
 */
export async function setInitialPassword(uid:string,actorUid:string,password:string){
 validateInitialPassword(password);
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||uid===actorUid)
  throw new HttpError(403,'Cannot set your own password from user management.');
 const ref=db.collection('profiles').doc(uid);
 const snap=await ref.get();
 if(!snap.exists)throw new HttpError(404,'Account not found.');
 const profile=snap.data() as Profile;
 if(profile.role==='super_admin'||profile.active!==true)throw new HttpError(403,'Cannot change a super administrator or disabled account password.');
 const user=await adminAuth.getUser(uid);
 if(!user.email||user.disabled||user.email.toLowerCase()!==String(profile.email).toLowerCase())
  throw new HttpError(409,'Account Auth identity does not match the saved profile.');
 await adminAuth.updateUser(uid,{password});
 const at=new Date().toISOString();
 try{await ref.update({adminPasswordProvisionedAt:at,updatedAt:at,mustChangePassword:true});}
 catch(error){
  // Never leave a newly set credential without the profile marker that
  // permits provisional sign-in. Revoke sign-in tokens as containment.
  await adminAuth.revokeRefreshTokens(uid).catch(()=>{});
  throw error;
 }
 await adminAuth.revokeRefreshTokens(uid);
 await audit(actorUid,'user.initial_password_assigned',uid,{unverified:!user.emailVerified,method:'admin_provisioned'}).catch(()=>{});
 return {emailVerificationRequired:!user.emailVerified,message:'Initial password saved securely. Give it to the account owner through a private channel; they can sign in now and should verify their email within 30 days.'};
}
