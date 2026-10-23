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
 super_admin:superAdmin,
 admin:superAdmin.filter(c=>!['staff.manage','bootstrap.manage'].includes(c)),
 reviewer:[
  'workspace.view','applications.read','applications.review',
  'documents.read','documents.verify','content.read','forms.read','intake.read',
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
