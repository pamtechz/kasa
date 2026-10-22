import 'server-only';
import {db} from '@/lib/firebase-admin';
import {HttpError} from '@/lib/errors';

export type PublicFeatureFlags={referralsEnabled:boolean};
/** Only persisted operational switches are exposed; never expose settings wholesale. */
export async function publicFeatureFlags():Promise<PublicFeatureFlags>{
 const doc=await db.collection('settings').doc('operations').get();
 return {referralsEnabled:doc.data()?.referralsEnabled!==false};
}
export async function requireReferralsEnabled():Promise<void>{
 if(!(await publicFeatureFlags()).referralsEnabled)
  throw new HttpError(403,'The KASA referral programme is currently paused.');
}
