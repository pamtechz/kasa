import type {Role} from './types';

/**
 * KASA access policy. Server authorization is mandatory: hiding a button
 * does not grant or revoke access. Permissions are never taken from a token's
 * custom role claim; the active profile in Firestore is authoritative.
 */
export type Capability =
  | 'applications.read' | 'applications.create' | 'applications.review' | 'applications.delete'
  | 'documents.read' | 'documents.upload' | 'documents.verify'
  | 'finance.read' | 'finance.record' | 'commissions.read' | 'commissions.settle'
  | 'agents.read' | 'agents.manage' | 'referrals.read' | 'referrals.manage' | 'payout.request'
  | 'forms.read' | 'forms.manage' | 'content.read' | 'content.manage'
  | 'intake.read' | 'intake.manage' | 'settings.read' | 'settings.manage'
  | 'automations.read' | 'automations.manage' | 'notifications.read'
  | 'notifications.mark' | 'notifications.broadcast' | 'notifications.delete'
  | 'users.read' | 'users.manage' | 'staff.manage' | 'system.setup'
  | 'profile.read' | 'profile.manage' | 'agent.poster';

const all:Capability[]=[
  'applications.read','applications.create','applications.review','applications.delete',
  'documents.read','documents.upload','documents.verify','finance.read','finance.record',
  'commissions.read','commissions.settle','agents.read','agents.manage',
  'referrals.read','referrals.manage','payout.request','forms.read','forms.manage',
  'content.read','content.manage','intake.read','intake.manage','settings.read','settings.manage',
  'automations.read','automations.manage','notifications.read','notifications.mark',
  'notifications.broadcast','notifications.delete','users.read','users.manage',
  'staff.manage','system.setup','profile.read','profile.manage','agent.poster'
];
const admin=all.filter(x=>!['staff.manage','system.setup'].includes(x));
const reviewer:Capability[]=[
  'applications.read','applications.create','applications.review','documents.read','documents.upload',
  'documents.verify','finance.read','commissions.read','agents.read','forms.read','content.read',
  'intake.read','settings.read','automations.read','notifications.read','notifications.mark',
  'users.read','profile.read','profile.manage','agent.poster'
];
const agent:Capability[]=[
  'applications.read','applications.create','referrals.read','referrals.manage','payout.request',
  'commissions.read','notifications.read','notifications.mark','profile.read','profile.manage','agent.poster'
];
const student:Capability[]=[
  'applications.read','documents.read','documents.upload','referrals.read','notifications.read',
  'notifications.mark','profile.read','profile.manage'
];
const finance:Capability[]=['finance.read','finance.record','notifications.read','notifications.mark','profile.read','profile.manage'];
export const ROLE_CAPABILITIES:Readonly<Record<Role,ReadonlySet<Capability>>>={
 super_admin:new Set(all),admin:new Set(admin),reviewer:new Set(reviewer),
 agent:new Set(agent),student:new Set(student),finance:new Set(finance)
};
export function hasCapability(role:Role|undefined|null,capability:Capability):boolean{
 return !!role && !!ROLE_CAPABILITIES[role]?.has(capability);
}
type HttpMethod='GET'|'POST'|'PUT'|'PATCH'|'DELETE';
type Entry={path:string;operations:Partial<Record<HttpMethod,Capability>>};
const entry=(path:string, operations:Entry['operations']):Entry=>({path,operations});

/** Every privileged API path and HTTP method must be explicitly catalogued. */
export const PRIVILEGED_ROUTES:readonly Entry[]=[
 entry('/api/admin/ads',{GET:'content.read',POST:'content.manage',PUT:'content.manage',DELETE:'content.manage'}),
 entry('/api/admin/agents/:id',{PATCH:'agents.manage',DELETE:'agents.manage'}),
 entry('/api/admin/agents',{GET:'agents.read',POST:'agents.manage'}),
 entry('/api/admin/automations',{GET:'automations.read',PUT:'automations.manage'}),
 entry('/api/admin/commissions',{GET:'commissions.read',PATCH:'commissions.settle',POST:'commissions.settle',DELETE:'commissions.settle'}),
 entry('/api/admin/content',{GET:'content.read',POST:'content.manage',PUT:'content.manage',DELETE:'content.manage'}),
 entry('/api/admin/file',{GET:'documents.read'}),
 entry('/api/admin/finance',{GET:'finance.read',POST:'finance.record'}),
 entry('/api/admin/forms/:id',{GET:'forms.read',PUT:'forms.manage',DELETE:'forms.manage'}),
 entry('/api/admin/forms/import',{POST:'forms.manage'}),
 entry('/api/admin/forms',{GET:'forms.read',POST:'forms.manage'}),
 entry('/api/admin/intake',{GET:'intake.read',PUT:'intake.manage'}),
 entry('/api/admin/seed',{POST:'system.setup'}),
 entry('/api/admin/settings/acceptance-letter/preview-enrollment-form',{POST:'settings.manage'}),
 entry('/api/admin/settings/acceptance-letter/preview',{POST:'documents.read'}),
 entry('/api/admin/settings/acceptance-letter/upload',{POST:'settings.manage'}),
 entry('/api/admin/settings/acceptance-letter',{GET:'settings.read',PUT:'settings.manage'}),
 entry('/api/admin/settings',{GET:'settings.read',PUT:'settings.manage'}),
 entry('/api/admin/setup/status',{GET:'settings.read'}),
 entry('/api/admin/site',{GET:'content.read',PUT:'content.manage'}),
 entry('/api/admin/staff/:id',{PATCH:'staff.manage',DELETE:'staff.manage'}),
 entry('/api/admin/staff',{GET:'staff.manage',POST:'staff.manage'}),
 entry('/api/admin/submissions/:id/documents',{GET:'documents.read',POST:'documents.upload',PATCH:'documents.verify'}),
 entry('/api/admin/submissions/:id/enrollment-form',{GET:'documents.read'}),
 entry('/api/admin/submissions/:id/letter',{GET:'documents.read'}),
 entry('/api/admin/submissions/:id/ocr',{POST:'documents.verify'}),
 entry('/api/admin/submissions/:id',{PATCH:'applications.review',DELETE:'applications.delete'}),
 entry('/api/admin/submissions/batch-download',{POST:'documents.read'}),
 entry('/api/admin/submissions/batch-email',{POST:'applications.review'}),
 entry('/api/admin/submissions',{GET:'applications.read',POST:'applications.create'}),
 entry('/api/admin/users/:id',{PATCH:'users.manage',DELETE:'users.manage'}),
 entry('/api/admin/users/provision',{POST:'users.manage'}),
 entry('/api/admin/users',{GET:'users.read'}),
 entry('/api/agent/leaderboard',{GET:'referrals.read'}),
 entry('/api/agent/payout-request',{GET:'payout.request',POST:'payout.request'}),
 entry('/api/agent/poster',{GET:'agent.poster'}),
 entry('/api/agent/referrals',{GET:'referrals.read',POST:'referrals.manage',PATCH:'referrals.manage',DELETE:'referrals.manage'}),
 entry('/api/notifications',{GET:'notifications.read',POST:'notifications.broadcast',PATCH:'notifications.mark',DELETE:'notifications.delete'})
];
function pathMatches(pattern:string,path:string):boolean{
 const expected=pattern.split('/');
 const actual=path.split('/');
 return expected.length===actual.length && expected.every((part,i)=>
   part.startsWith(':')?actual[i].length>0:part===actual[i]);
}
export function requiredApiCapability(path:string,method:string):Capability|undefined{
 // Fail closed for unrecognized endpoints, verbs and future APIs.
 const matched=PRIVILEGED_ROUTES.find(route=>route.path===path) ||
  PRIVILEGED_ROUTES.find(route=>pathMatches(route.path,path));
 return matched?.operations[method.toUpperCase() as HttpMethod];
}
export function isControlledApi(path:string):boolean{
 return path.startsWith('/api/admin/')||path.startsWith('/api/agent/')||path==='/api/notifications';
}

/** Page gating and visible navigation use the same role matrix as the API. */
export function requiredPageCapability(path:string):Capability|undefined{
 if(path.startsWith('/dashboard/staff'))return 'staff.manage';
 if(path.startsWith('/dashboard/setup'))return 'system.setup';
 if(path.startsWith('/dashboard/finance'))return 'finance.read';
 if(path.startsWith('/dashboard/commissions'))return 'commissions.read';
 if(path.startsWith('/dashboard/agents'))return 'agents.read';
 if(path.startsWith('/dashboard/intake'))return 'intake.read';
 if(path.startsWith('/dashboard/forms'))return 'forms.read';
 if(path.startsWith('/dashboard/settings/acceptance-letter'))return 'settings.read';
 if(path.startsWith('/dashboard/settings'))return 'settings.read';
 if(path.startsWith('/dashboard/automations'))return 'automations.read';
 if(path.startsWith('/dashboard/website')||path.startsWith('/dashboard/announcements')||path.startsWith('/dashboard/programmes'))return 'content.read';
 if(path.startsWith('/dashboard/applications/new'))return 'applications.create';
 if(path.startsWith('/dashboard/applications'))return 'applications.read';
 if(path.startsWith('/dashboard/referrals'))return 'referrals.read';
 if(path.startsWith('/dashboard/notifications'))return 'notifications.read';
 if(path.startsWith('/dashboard/profile'))return 'profile.read';
 if(path==='/dashboard'||path==='/dashboard/')return 'profile.read';
 if(path.startsWith('/agent-portal'))return 'referrals.read';
 if(path.startsWith('/student-portal')||path.startsWith('/student/')||path.startsWith('/my-applications'))return 'profile.read';
 return undefined;
}
export function canAccessPage(role:Role|null|undefined,path:string):boolean{
 const cap=requiredPageCapability(path);
 return !!cap && hasCapability(role,cap);
}
