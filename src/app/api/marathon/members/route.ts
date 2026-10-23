import {z} from 'zod';
import {adminAuth,db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity,requireMarathon,marathonRoles} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
export const runtime='nodejs';
const schema=z.object({email:z.string().email().max(240),role:z.enum(marathonRoles)});
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req);requireMarathon(actor,'super');
  const parsed=schema.safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,'Provide a registered email and Marathon role.');
  const email=parsed.data.email.toLowerCase().trim();
  const authUser=await adminAuth.getUserByEmail(email).catch(()=>null);
  if(!authUser||!authUser.emailVerified)throw new HttpError(400,'User must register and verify the email first.');
  const profile=await db.collection('profiles').doc(authUser.uid).get();
  if(profile.data()?.active===false)throw new HttpError(403,'This user is deactivated.');
  if(profile.data()?.role==='super_admin')throw new HttpError(403,'Super administrators inherit access and cannot be reassigned.');
  const doc={email,role:parsed.data.role,active:true,displayName:authUser.displayName||email.split('@')[0],updatedAt:new Date().toISOString(),updatedBy:actor.uid};
  await db.collection('marathonMembers').doc(authUser.uid).set(doc,{merge:true});
  await db.collection('marathonAudit').add({action:'member.assigned',at:new Date().toISOString(),actor:actor.uid,targetUid:authUser.uid,role:parsed.data.role});
  return json({member:{uid:authUser.uid,...doc}});
 }catch(e){return fail(e);}
}
