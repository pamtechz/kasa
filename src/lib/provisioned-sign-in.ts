import type {Profile} from './types';
/** Unverified accounts are allowed a short provisional window only after a global
 * super administrator intentionally sets their initial Firebase Auth password.
 * This is NOT an email-ownership assertion and never changes emailVerified.
 */
export const PROVISIONAL_DAYS=30;
export function canUseUnverifiedProvisionedAccount(profile:Profile|undefined,email:string|undefined):boolean{
 if(!profile||profile.active!==true||!email||profile.email?.trim().toLowerCase()!==email.trim().toLowerCase())return false;
 if(!profile.adminPasswordProvisionedAt)return false;
 const provisionedAt=Date.parse(profile.adminPasswordProvisionedAt);
 return Number.isFinite(provisionedAt)&&provisionedAt<=Date.now()&&Date.now()-provisionedAt<PROVISIONAL_DAYS*86400000;
}
