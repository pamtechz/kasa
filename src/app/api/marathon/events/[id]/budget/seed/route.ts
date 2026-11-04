import {fail,HttpError} from '@/lib/errors';
import {marathonIdentity} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
export const runtime='nodejs';

/** Retired permanently: the legacy 6,000-runner / 80-line template conflicts
 * with the user's 5,000-runner working budget. Import of that source is unsafe.
 * The complete replacement is handled through an audited production migration.
 */
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req);
  if(actor.role!=='super_admin')
   throw new HttpError(403,'Only the KASA super administrator may manage source budgets.');
  throw new HttpError(410,'The old 80-line budget template has been retired. The official March 2027 working budget is managed in the active event budget.');
 }catch(error){return fail(error);}
}
