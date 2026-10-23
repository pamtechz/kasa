import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity,requireMarathon,marathonRoles} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
export const runtime='nodejs';
export async function PATCH(req:Request,{params}:{params:Promise<{uid:string}>}){
 try{
  sameOrigin(req);const actor=await marathonIdentity(req);requireMarathon(actor,'super');
  const {uid}=await params;
  if(uid===actor.uid)throw new HttpError(403,'Cannot change your own Marathon membership.');
  const parsed=z.object({role:z.enum(marathonRoles).optional(),active:z.boolean().optional()}).refine(x=>Object.keys(x).length>0).safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,'Invalid membership change.');
  const ref=db.collection('marathonMembers').doc(uid);
  if(!(await ref.get()).exists)throw new HttpError(404,'Marathon member not found.');
  await ref.update({...parsed.data,updatedAt:new Date().toISOString(),updatedBy:actor.uid});
  await db.collection('marathonAudit').add({action:'member.updated',at:new Date().toISOString(),actor:actor.uid,targetUid:uid,changes:parsed.data});
  return json({ok:true});
 }catch(e){return fail(e);}
}
