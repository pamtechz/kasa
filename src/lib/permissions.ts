import type {Role} from './types';
export type Permission='applications.read'|'applications.review'|'applications.delete'|'content.read'|'content.manage'|'forms.read'|'forms.manage'|'intake.read'|'intake.manage'|'agents.read'|'agents.manage'|'finance.read'|'finance.manage'|'commissions.read'|'commissions.manage'|'settings.read'|'settings.manage'|'automations.manage'|'staff.manage'|'setup.manage'|'referrals.read'|'notifications.read'|'profile.read'|'users.read'|'users.manage'|'acceptance.manage'|'batch.notify';
const admins:Role[]=['super_admin','admin'];
const reviewers:Role[]=[...admins,'reviewer'];
const financing:Role[]=[...admins,'finance'];
export const grants:Readonly<Record<Permission,readonly Role[]>>={
 'applications.read':[...reviewers,'agent'],'applications.review':reviewers,'applications.delete':admins,
 'content.read':reviewers,'content.manage':admins,
 'forms.read':reviewers,'forms.manage':admins,
 'intake.read':reviewers,'intake.manage':admins,
 'agents.read':reviewers,'agents.manage':admins,
 'finance.read':[...financing,'reviewer'],'finance.manage':financing,
 'commissions.read':reviewers,'commissions.manage':admins,
 'settings.read':reviewers,'settings.manage':admins,
 'automations.manage':admins,'staff.manage':['super_admin'],'setup.manage':['super_admin'],
 'referrals.read':[...admins,'agent'],'users.read':reviewers,'users.manage':admins,'acceptance.manage':admins,'batch.notify':reviewers,
 'notifications.read':[...reviewers,'agent','finance','student'],
 'profile.read':['super_admin','admin','reviewer','finance','agent','student']
};
export const can=(role:Role|null|undefined,permission:Permission):boolean=>Boolean(role&&grants[permission].includes(role));
const paths:readonly {prefix:string;permission:Permission}[]=[
 {prefix:'/dashboard/staff',permission:'staff.manage'},{prefix:'/dashboard/setup',permission:'setup.manage'},
 {prefix:'/dashboard/finance',permission:'finance.read'},{prefix:'/dashboard/commissions',permission:'commissions.read'},
 {prefix:'/dashboard/forms',permission:'forms.read'},{prefix:'/dashboard/intake',permission:'intake.read'},
 {prefix:'/dashboard/programmes',permission:'content.read'},{prefix:'/dashboard/website',permission:'content.read'},
 {prefix:'/dashboard/announcements',permission:'content.read'},
 {prefix:'/dashboard/automations',permission:'automations.manage'},
 {prefix:'/dashboard/settings/acceptance-letter',permission:'acceptance.manage'},
 {prefix:'/dashboard/settings',permission:'settings.read'},{prefix:'/dashboard/agents',permission:'agents.read'},
 {prefix:'/dashboard/applications',permission:'applications.read'},
 {prefix:'/dashboard/referrals',permission:'referrals.read'},{prefix:'/dashboard/notifications',permission:'notifications.read'},
 {prefix:'/dashboard/profile',permission:'profile.read'}
];
export function canViewDashboard(role:Role|null|undefined,path:string):boolean{
 if(!role||role==='student')return false;
 const entry=paths.find(p=>path===p.prefix||path.startsWith(p.prefix+'/'));
 return entry?can(role,entry.permission):path==='/dashboard';
}

export function landingForRole(role:Role):string{
 switch(role){
  case 'super_admin':case 'admin':return '/dashboard';
  case 'reviewer':return '/dashboard/applications';
  case 'finance':return '/dashboard/finance';
  case 'agent':return '/agent-portal';
  case 'student':return '/student-portal';
 }
}
export function safeDestination(role:Role,requested:string|null):string{
 const fallback=landingForRole(role);
 if(!requested||!requested.startsWith('/')||requested.startsWith('//')||
    requested.includes('\\')||/[\u0000-\u001F]/.test(requested))return fallback;
 const base=requested.split('?')[0].split('#')[0];
 if(base==='/bootstrap')return '/bootstrap';
 if(base.startsWith('/dashboard'))return canViewDashboard(role,base)?requested:fallback;
 if(role==='student'&&(base==='/my-applications'||base.startsWith('/student-portal')))return requested;
 if(role==='agent'&&(base==='/agent-portal'||base.startsWith('/dashboard/referrals')))return requested;
 if(['/apply','/programmes','/admissions','/account'].some(p=>base===p||base.startsWith(p+'/')))return requested;
 return fallback;
}
