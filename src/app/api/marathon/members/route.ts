import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity,requireMarathon,marathonRoles} from '@/lib/marathon';
import {ensureSchoolIdentity} from '@/lib/account-onboarding';
import type {Profile} from '@/lib/types';
import {sameOrigin} from '@/lib/security';

export const runtime='nodejs';
const schema=z.object({
 email:z.string().trim().email().max(240),
 displayName:z.string().trim().max(120).optional(),
 initialPassword:z.string().min(12).max(128).optional(),
 role:z.enum(marathonRoles)
}).strict();

export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req);
  requireMarathon(actor,'super');
  const parsed=schema.safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,'Provide an email, name and valid Marathon role.');
  const email=parsed.data.email.trim().toLowerCase();
  const account=await ensureSchoolIdentity({
   email,displayName:parsed.data.displayName,initialPassword:parsed.data.initialPassword,
   requireExistingOrPassword:true,schoolRole:'marathon_only',actorUid:actor.uid
  });
  if(account.uid===actor.uid)throw new HttpError(403,'The school super admin already has inherited Marathon access.');
  const profileRef=db.collection('profiles').doc(account.uid);
  const now=new Date().toISOString();
  let member:Record<string,unknown>|null=null;
  await db.runTransaction(async tx=>{
   const snap=await tx.get(profileRef);
   if(!snap.exists)throw new HttpError(404,'KASA School profile could not be created.');
   const profile=snap.data() as Profile;
   if(profile.active!==true)throw new HttpError(403,'The KASA School profile is inactive.');
   if(profile.role==='super_admin')throw new HttpError(403,'School super administrators already inherit Marathon access.');
   if(profile.role==='student')throw new HttpError(409,'This email belongs to a School student. Student accounts cannot join Marathon operations; use a separate non-student email.');
   const previous=profile.marathonAccess;
   const secondary={
    role:parsed.data.role,active:true,
    assignedAt:previous?.assignedAt||now,assignedBy:previous?.assignedBy||actor.uid,
    updatedAt:now,updatedBy:actor.uid
   };
   // Shared School profile: this only modifies Marathon access, not the School role.
   tx.update(profileRef,{marathonAccess:secondary});
   tx.create(db.collection('marathonAudit').doc(),{
    action:'profile.marathonRole.assigned',at:now,actor:actor.uid,targetUid:account.uid,
    previousRole:previous?.role||null,role:secondary.role,
    schoolAccountCreated:account.authCreated
   });
   member={
    uid:account.uid,email:profile.email||email,displayName:profile.displayName||email,
    schoolRole:profile.role,role:secondary.role,schoolActive:profile.role!=='marathon_only',
    marathonActive:secondary.active,active:secondary.active,
    verificationPending:account.verificationPending
   };
  });
  return json({
   member,
   schoolAccountCreated:account.authCreated,
   onboardingEmailSent:account.onboardingEmailSent,
   verificationPending:account.verificationPending,
   message:account.authCreated&&parsed.data.initialPassword
    ?'Marathon-only account created with the initial password. Share it privately. The member may sign in now and has 30 days to verify the email.'
    :account.verificationPending
    ?account.onboardingEmailSent
      ?'Marathon-only access created. A password setup email was requested; the member must verify their email before signing in.'
      :'Marathon-only access created. Ask the member to use Forgot password at the unified KASA login, then verify their email.'
    :'Existing eligible KASA account linked to Marathon access.'
  },201);
 }catch(e){return fail(e);}
}
