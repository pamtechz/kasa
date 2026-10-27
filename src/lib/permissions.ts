import type {Role} from './types';

// Source of truth for front-end feature visibility AND authenticated server
// endpoints. Firestore client rules remain strictly smaller: the Admin SDK
// bypasses those rules, so every privileged operation must check the server.
export type Capability =
 | 'workspace.view'|'applications.read'|'applications.review'|'applications.manage'
 | 'documents.read'|'documents.verify'|'documents.upload'
 | 'content.read'|'content.manage'|'forms.read'|'forms.manage'
 | 'intake.read'|'intake.manage'|'site.read'|'site.manage'
 | 'ads.read'|'ads.manage'|'automation.read'|'automation.manage'
 | 'finance.read'|'finance.record'|'commissions.read'|'commissions.manage'
 | 'agents.read'|'agents.manage'|'referrals.read'|'referrals.manage'
 | 'payouts.read'|'payouts.request'|'users.read'|'users.manage'
 | 'staff.manage'|'bootstrap.manage'|'settings.read'|'settings.manage'
 | 'notifications.read'|'profile.read'|'profile.edit';

const superAdmin:readonly Capability[]=[
 'workspace.view','applications.read','applications.review','applications.manage',
 'documents.read','documents.verify','documents.upload',
 'content.read','content.manage','forms.read','forms.manage','intake.read','intake.manage',
 'site.read','site.manage','ads.read','ads.manage','automation.read','automation.manage',
 'finance.read','finance.record','commissions.read','commissions.manage',
 'agents.read','agents.manage','referrals.read','referrals.manage',
 'payouts.read','payouts.request','users.read','users.manage','staff.manage',
 'bootstrap.manage','settings.read','settings.manage',
 'notifications.read','profile.read','profile.edit'
];
const matrix:Record<Role,readonly Capability[]>={
 // Auth identity may exist only for KASA Life Marathon, with zero School privileges.
 marathon_only:[],
 super_admin:superAdmin,
 admin:superAdmin.filter(c=>!['staff.manage','bootstrap.manage'].includes(c)),
 reviewer:[
  'workspace.view','applications.read','applications.review',
  'documents.read','documents.verify','documents.upload','content.read','forms.read','intake.read',
  'site.read','finance.read','commissions.read','agents.read','users.read',
  'payouts.read','settings.read','notifications.read','profile.read','profile.edit'
 ],
 finance:[
  'workspace.view','finance.read','finance.record','commissions.read',
  'notifications.read','profile.read','profile.edit'
 ],
 agent:[
  'workspace.view','applications.read','referrals.read','referrals.manage',
  'payouts.read','payouts.request','notifications.read','profile.read','profile.edit'
 ],
 student:[
  'applications.read','documents.read','documents.upload','referrals.read',
  'notifications.read','profile.read','profile.edit'
 ]
};
export const roleCapabilities:Readonly<Record<Role,readonly Capability[]>>=matrix;
export function can(role:Role|undefined|null,capability:Capability):boolean{
 return Boolean(role && matrix[role]?.includes(capability));
}

/** Central request-level permissions: unknown internal routes fail closed.
 * This is enforced AFTER a verified Firebase ID token and active role profile
 * are checked, and BEFORE any privileged handler reads or writes Firestore.
 * Privileged endpoint handlers retain their own tighter record-level checks.
 */
export function routeCapability(pathname:string,method:string):Capability|null{
 const route=pathname.replace(/\/$/,'');
 const verb=method.toUpperCase();
 const path=(pattern:string)=>new RegExp('^'+pattern+'$').test(route);
 if(path('/api/admin/fee-tariffs')||path('/api/admin/fee-quotes'))return verb==='GET'?'finance.read':verb==='POST'?'finance.record':null;
 if(path('/api/admin/finance'))return verb==='GET'?'finance.read':'finance.record';
 if(path('/api/admin/commissions'))return verb==='GET'?'commissions.read':'commissions.manage';
 if(path('/api/admin/staff(?:/[^/]+)?'))return 'staff.manage';
 if(path('/api/admin/seed'))return 'bootstrap.manage';
 if(path('/api/admin/setup/status'))return 'settings.read';
 if(path('/api/admin/users/[^/]+/password-reset')||path('/api/admin/users/[^/]+/initial-password'))return verb==='POST'?'staff.manage':null;
 if(path('/api/admin/users(?:/[^/]+)?')||path('/api/admin/users/provision'))
  return verb==='GET'?'users.read':'users.manage';
 if(path('/api/admin/agents(?:/[^/]+)?'))return verb==='GET'?'agents.read':'agents.manage';
 if(path('/api/admin/ads'))return verb==='GET'?'ads.read':'ads.manage';
 if(path('/api/admin/automations'))return verb==='GET'?'automation.read':'automation.manage';
 if(path('/api/admin/content'))return verb==='GET'?'content.read':'content.manage';
 if(path('/api/admin/forms/import'))return 'forms.manage';
 if(path('/api/admin/forms(?:/[^/]+)?'))return verb==='GET'?'forms.read':'forms.manage';
 if(path('/api/admin/intake'))return verb==='GET'?'intake.read':'intake.manage';
 if(path('/api/admin/site'))return verb==='GET'?'site.read':'site.manage';
 if(path('/api/admin/settings/acceptance-letter/preview-enrollment-form'))return 'settings.manage';
 if(path('/api/admin/settings/acceptance-letter/preview'))return 'settings.read';
 if(path('/api/admin/settings(?:/acceptance-letter(?:/upload)?)?'))
  return verb==='GET'?'settings.read':'settings.manage';
 if(path('/api/admin/file'))return 'documents.read';
 if(path('/api/admin/submissions/batch-email'))return 'applications.review';
 if(path('/api/admin/submissions/batch-download'))return 'documents.read';
 if(path('/api/admin/submissions/[^/]+/documents'))
  return verb==='GET'?'documents.read':verb==='PATCH'?'documents.verify':'documents.upload';
 if(path('/api/admin/submissions/[^/]+/ocr'))return 'documents.verify';
 if(path('/api/admin/submissions/[^/]+/(?:letter|enrollment-form)'))return 'documents.read';
 if(path('/api/admin/submissions/[^/]+'))
  return verb==='GET'?'applications.read':verb==='DELETE'?'applications.manage':'applications.review';
 if(path('/api/admin/submissions'))return verb==='GET'?'applications.read':'applications.review';
 if(path('/api/agent/leaderboard')||path('/api/agent/poster'))return 'referrals.read';
 if(path('/api/agent/referrals'))return verb==='GET'?'referrals.read':'referrals.manage';
 if(path('/api/agent/payout-request'))return verb==='GET'?'payouts.read':'payouts.request';
 return null;
}
