import {requirePermission,audit,sameOrigin} from '@/lib/security';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {policySchema} from '@/lib/intake-policy';
import {loadIntake, invalidateIntakeCache} from '@/lib/intake-server';
export const runtime='nodejs';
export async function GET(req:Request){
 try{await requirePermission(req,'intake.read');return json({policy:await loadIntake()});}
 catch(e){return fail(e);}
}
export async function PUT(req:Request){
 try{
  sameOrigin(req);
  const actor=await requirePermission(req,'intake.manage');
  const parsed=policySchema.safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,parsed.error.issues.map(e=>e.message).slice(0,4).join('; '));
  await db.collection('settings').doc('intake').set({policy:parsed.data,updatedAt:new Date().toISOString(),updatedBy:actor.uid},{merge:true});
  invalidateIntakeCache();
  await audit(actor.uid,'intake.policy_updated','settings/intake',{applicationsOpen:parsed.data.applicationsOpen});
  return json({ok:true});
 }catch(e){return fail(e);}
}
