import 'server-only';
import {adminAuth,db} from '@/lib/firebase-admin';
import {HttpError} from '@/lib/errors';
import type {Profile,Role} from '@/lib/types';

export const marathonRoles = ['kasaAdmin','kasaOperations','kasaEditor','kasaReviewer','kasaClient'] as const;
export type MarathonRole = typeof marathonRoles[number] | 'super_admin';
export type MarathonStatus = 'todo' | 'doing' | 'blocked' | 'done';
export type MarathonTask = {
 id:string;title:string;lead:string;dueDate:string|null;priority:string;urgency:string;
 importance:string;status:MarathonStatus;dependencies:string[];nextStep:string;
 dateBasis?:string;sourceDeadline?:string;cadence?:string;origin?:string;
 completedAt:string|null;completedBy?:string|null;recordedAt?:string|null;
 evidence?:string;notes?:string;archived?:boolean;revision:number;
 updatedAt:string;updatedBy:string;
};
export type MarathonIdentity={uid:string;email:string;displayName:string;schoolRole:Role;role:MarathonRole};
export const marathonCollection=db.collection('marathonTasks');
export function canEdit(role:MarathonRole){return ['super_admin','kasaAdmin','kasaOperations','kasaEditor'].includes(role);}
export function canReview(role:MarathonRole){return ['super_admin','kasaAdmin','kasaOperations','kasaReviewer'].includes(role);}
// KASA School's global super administrator alone can configure the secondary role,
// but the controls live in /marthon/team rather than the root school admin panel.
export function canManage(role:MarathonRole){return role==='super_admin';}

export async function marathonIdentity(req:Request):Promise<MarathonIdentity>{
 const raw=req.headers.get('authorization')||'';
 if(!raw.startsWith('Bearer '))throw new HttpError(401,'Sign in with your existing KASA School account.');
 let verified;
 try{verified=await adminAuth.verifyIdToken(raw.slice(7),true);}
 catch{throw new HttpError(401,'Your session has expired. Sign in again.');}
 if(!verified.email_verified)throw new HttpError(403,'Verify your KASA account email before accessing Marathon operations.');
 const profileSnapshot=await db.collection('profiles').doc(verified.uid).get();
 const profile=profileSnapshot.data() as Profile|undefined;
 // Marathon may only use an existing, active KASA School profile. No shadow membership.
 if(!profileSnapshot.exists||!profile||profile.active!==true)
  throw new HttpError(403,'An active KASA School profile is required for Marathon access.');
 if(profile.role==='super_admin'){
  return {uid:verified.uid,email:verified.email||profile.email,displayName:profile.displayName||verified.name||'',schoolRole:profile.role,role:'super_admin'};
 }
 const secondRole=profile.marathonAccess;
 if(!secondRole||secondRole.active!==true||!marathonRoles.includes(secondRole.role))
  throw new HttpError(403,'Your KASA School super administrator has not enabled a Marathon role for this profile.');
 return {uid:verified.uid,email:verified.email||profile.email,displayName:profile.displayName||verified.name||'',schoolRole:profile.role,role:secondRole.role};
}
export function requireMarathon(identity:MarathonIdentity,permission:'edit'|'review'|'manage'|'super'){
 const ok=permission==='edit'?canEdit(identity.role):
 permission==='review'?canReview(identity.role):
 permission==='manage'?canManage(identity.role):identity.role==='super_admin';
 if(!ok)throw new HttpError(403,'Your Marathon role does not permit this operation.');
}
