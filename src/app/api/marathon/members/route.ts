import {z} from 'zod';
import {adminAuth,db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity,requireMarathon,marathonRoles} from '@/lib/marathon';
import type {Profile} from '@/lib/types';
import {sameOrigin} from '@/lib/security';

export const runtime='nodejs';
const schema=z.object({email:z.string().trim().email().max(240),role:z.enum(marathonRoles)}).strict();
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req);
  requireMarathon(actor,'super');
  const parsed=schema.safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,'Provide a registered KASA School email and Marathon role.');
  const email=parsed.data.email.toLowerCase();
  const authUser=await adminAuth.getUserByEmail(email).catch(()=>null);
  if(!authUser||!authUser.emailVerified)
   throw new HttpError(400,'This person must first sign up with KASA School and verify their email.');
  if(authUser.uid===actor.uid)throw new HttpError(403,'The school super admin already has inherited Marathon access.');
  const profileRef=db.collection('profiles').doc(authUser.uid);
  const now=new Date().toISOString();
  let member:Record<string,unknown>|null=null;
  await db.runTransaction(async tx=>{
   const snap=await tx.get(profileRef);
   if(!snap.exists)throw new HttpError(404,'This account has no KASA School profile.');
   const profile=snap.data() as Profile;
   if(profile.active!==true)throw new HttpError(403,'The KASA School profile is inactive.');
   if(profile.role==='super_admin')throw new HttpError(403,'School super administrators already inherit Marathon access.');
   const previous=profile.marathonAccess;
   const secondary={
    role:parsed.data.role,active:true,
    assignedAt:previous?.assignedAt||now,assignedBy:previous?.assignedBy||actor.uid,
    updatedAt:now,updatedBy:actor.uid
   };
   // Atomic partial update: never replace school role, school profile, or contact details.
   tx.update(profileRef,{marathonAccess:secondary});
   tx.create(db.collection('marathonAudit').doc(),{
    action:'profile.marathonRole.assigned',at:now,actor:actor.uid,targetUid:authUser.uid,
    previousRole:previous?.role||null,role:secondary.role
   });
   member={
    uid:authUser.uid,email:profile.email||email,displayName:profile.displayName||authUser.displayName||email,
    schoolRole:profile.role,role:secondary.role,schoolActive:true,marathonActive:secondary.active,active:secondary.active
   };
  });
  return json({member},201);
 }catch(e){return fail(e);}
}
