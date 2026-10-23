import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity,requireMarathon,marathonRoles} from '@/lib/marathon';
import type {Profile} from '@/lib/types';
import {sameOrigin} from '@/lib/security';

export const runtime='nodejs';
const schema=z.object({
 role:z.enum(marathonRoles).optional(),active:z.boolean().optional()
}).strict().refine(x=>Object.keys(x).length>0);
export async function PATCH(req:Request,{params}:{params:Promise<{uid:string}>}){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req);
  requireMarathon(actor,'super');
  const {uid}=await params;
  if(!uid||uid.includes('/')||uid===actor.uid)
   throw new HttpError(403,'The super administrator cannot modify their own Marathon access.');
  const parsed=schema.safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,'Use an allowed Marathon role or a true/false access status.');
  const profileRef=db.collection('profiles').doc(uid);
  const now=new Date().toISOString();
  let member:Record<string,unknown>|null=null;
  await db.runTransaction(async tx=>{
   const snap=await tx.get(profileRef);
   if(!snap.exists)throw new HttpError(404,'KASA School profile not found.');
   const profile=snap.data() as Profile;
   if(profile.role==='super_admin')throw new HttpError(403,'Global school super admin access cannot be edited here.');
   if(!profile.marathonAccess||!marathonRoles.includes(profile.marathonAccess.role))
    throw new HttpError(404,'This school profile has no Marathon role. Assign one first.');
   if(parsed.data.active===true&&profile.active!==true)
    throw new HttpError(403,'Reactivate the main KASA School account before enabling Marathon access.');
   const secondary={...profile.marathonAccess,...parsed.data,updatedAt:now,updatedBy:actor.uid};
   tx.update(profileRef,{marathonAccess:secondary});
   tx.create(db.collection('marathonAudit').doc(),{
    action:'profile.marathonRole.updated',at:now,actor:actor.uid,targetUid:uid,changes:parsed.data
   });
   member={
    uid,email:profile.email,displayName:profile.displayName,
    schoolRole:profile.role,role:secondary.role,active:profile.active===true&&secondary.active===true
   };
  });
  return json({ok:true,member});
 }catch(e){return fail(e);}
}
