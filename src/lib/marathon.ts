import 'server-only';
import {adminAuth,db} from '@/lib/firebase-admin';
import {HttpError} from '@/lib/errors';

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
export type MarathonIdentity = {uid:string;email:string;displayName:string;role:MarathonRole};
export const marathonCollection = db.collection('marathonTasks');
export function canEdit(role:MarathonRole){return ['super_admin','kasaAdmin','kasaOperations','kasaEditor'].includes(role);}
export function canReview(role:MarathonRole){return ['super_admin','kasaAdmin','kasaOperations','kasaReviewer'].includes(role);}
export function canManage(role:MarathonRole){return role==='super_admin'||role==='kasaAdmin';}

export async function marathonIdentity(req:Request):Promise<MarathonIdentity>{
 const raw=req.headers.get('authorization')||'';
 if(!raw.startsWith('Bearer '))throw new HttpError(401,'Sign in to the Marathon workspace.');
 let verified;
 try{verified=await adminAuth.verifyIdToken(raw.slice(7),true);}
 catch{throw new HttpError(401,'Your session has expired. Sign in again.');}
 if(!verified.email_verified)throw new HttpError(403,'Verify your email before accessing Marathon operations.');
 const profile=await db.collection('profiles').doc(verified.uid).get();
 if(profile.exists&&profile.data()?.active===false)throw new HttpError(403,'Your account has been deactivated.');
 if(profile.data()?.role==='super_admin'&&profile.data()?.active===true){
  return {uid:verified.uid,email:verified.email||'',displayName:profile.data()?.displayName||verified.name||'',role:'super_admin'};
 }
 const member=await db.collection('marathonMembers').doc(verified.uid).get();
 const m=member.data();
 if(!m||m.active!==true||!marathonRoles.includes(m.role))
  throw new HttpError(403,'Your Marathon role has not been assigned. Contact the organiser.');
 return {uid:verified.uid,email:verified.email||'',displayName:m.displayName||verified.name||verified.email||'',role:m.role};
}
export function requireMarathon(identity:MarathonIdentity,permission:'edit'|'review'|'manage'|'super'){
 const ok=permission==='edit'?canEdit(identity.role):
 permission==='review'?canReview(identity.role):
 permission==='manage'?canManage(identity.role):identity.role==='super_admin';
 if(!ok)throw new HttpError(403,'Your Marathon role does not permit this operation.');
}
