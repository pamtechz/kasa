import type {Profile,Role} from './types';

/** Client-safe routing policy; server APIs independently enforce live access. */
export function mayAccessMarathon(profile:Pick<Profile,'role'|'active'|'marathonAccess'>):boolean{
 return profile.active===true && (profile.role==='super_admin' ||
  (profile.role!=='student' && profile.marathonAccess?.active===true));
}
export function mayAccessSchool(role:Role):boolean{return role!=='marathon_only';}

/** Unknown, external and cross-workspace targets are ignored, not navigated. */
export function workspaceDestination(profile:Pick<Profile,'role'|'active'|'marathonAccess'>,next:string|null):string|null{
 if(profile.active!==true)return null;
 const role=profile.role;
 const marathon=mayAccessMarathon(profile);
 if(role==='marathon_only')return marathon?'/marathon':null;
 if(next && next.startsWith('/') && !next.startsWith('//') &&
  !/[\\?#%]/.test(next) && !next.split('/').includes('..') && !next.split('/').includes('.')){
  if(marathon && /^\/marathon(?:\/[a-z0-9-]+)*$/.test(next) && next!=='/marthon/login')return next;
  if(role==='student' && ['/student-portal','/my-applications'].includes(next))return '/student-portal';
  if(role==='agent' && next==='/agent-portal')return next;
  if(['super_admin','admin','reviewer','finance'].includes(role) && /^\/dashboard(?:\/[a-z0-9-]+)*$/.test(next))return next;
  if(role==='super_admin' && next==='/bootstrap')return next;
 }
 if(role==='super_admin'||role==='admin')return '/dashboard';
 if(role==='reviewer')return '/dashboard/applications';
 if(role==='finance')return '/dashboard/finance';
 if(role==='agent')return '/agent-portal';
 return '/student-portal';
}
