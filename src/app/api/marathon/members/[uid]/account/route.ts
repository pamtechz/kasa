import {adminAuth,db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity,requireMarathon,marathonRoles} from '@/lib/marathon';
import {sameOrigin,audit} from '@/lib/security';
import {z} from 'zod';
import type {Profile,Role} from '@/lib/types';
export const runtime='nodejs';
const schoolRoles=['marathon_only','agent','reviewer','admin','finance'] as const;
const schema=z.object({
 displayName:z.string().trim().min(1).max(120).optional(),
 phone:z.string().trim().max(40).optional(),district:z.string().trim().max(100).optional(),
 province:z.string().trim().max(100).optional(),address:z.string().trim().max(300).optional(),
 active:z.boolean().optional(),schoolRole:z.enum(schoolRoles).optional(),
 marathonRole:z.enum(marathonRoles).optional(),marathonActive:z.boolean().optional()
}).strict().refine(x=>Object.keys(x).length>0);
async function guard(req:Request,uid:string){
 const actor=await marathonIdentity(req);requireMarathon(actor,'super');
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||uid===actor.uid)throw new HttpError(403,'Cannot edit your own or an invalid account.');
 const ref=db.collection('profiles').doc(uid);const snap=await ref.get();
 if(!snap.exists)throw new HttpError(404,'Account not found.');
 const profile=snap.data() as Profile;
 if(profile.role==='super_admin')throw new HttpError(403,'Global super administrator accounts cannot be edited here.');
 return {actor,ref,profile};
}
export async function GET(req:Request,{params}:{params:Promise<{uid:string}>}){
 try{
  const {uid}=await params;
  const {profile}=await guard(req,uid);
  const auth=await adminAuth.getUser(uid);
  return json({account:{uid,email:profile.email,displayName:profile.displayName,role:profile.role,
   active:profile.active,phone:profile.phone||'',district:profile.district||'',
   province:profile.province||'',address:profile.address||'',
   marathonRole:profile.marathonAccess?.role||null,marathonActive:profile.marathonAccess?.active===true,
   emailVerified:auth.emailVerified,mustChangePassword:Boolean(profile.mustChangePassword)}});
 }catch(e){return fail(e);}
}
export async function PATCH(req:Request,{params}:{params:Promise<{uid:string}>}){
 try{
  sameOrigin(req);
  const {uid}=await params;
  const {actor,ref,profile}=await guard(req,uid);
  const body=schema.safeParse(await req.json().catch(()=>({})));
  if(!body.success)throw new HttpError(400,'Invalid account fields or Marathon role.');
  if(body.data.schoolRole==='marathon_only'&&profile.role!=='marathon_only')
   throw new HttpError(409,'Cannot remove School workspace through Marathon profile editing.');
  if(body.data.schoolRole&&body.data.schoolRole!==profile.role){
   const identity=await adminAuth.getUser(uid);
   if(!identity.emailVerified&&!profile.adminPasswordProvisionedAt)
    throw new HttpError(403,'Provision an initial password or verify the email before changing School roles.');
  }
  if(body.data.marathonActive===true&&body.data.active===false)
   throw new HttpError(409,'Cannot enable Marathon access while disabling the main account.');
  const now=new Date().toISOString();
  const updates:Record<string,unknown>={updatedAt:now};
  for(const field of ['displayName','phone','district','province','address','active'] as const)
   if(body.data[field]!==undefined)updates[field]=body.data[field];
  if(body.data.schoolRole)updates.role=body.data.schoolRole as Role;
  if(body.data.marathonRole||body.data.marathonActive!==undefined){
   if(profile.role==='student')throw new HttpError(403,'School students cannot access Marathon.');
   const old=profile.marathonAccess;
   const nextRole=body.data.marathonRole||old?.role;
   if(!nextRole)throw new HttpError(400,'Assign a Marathon role before enabling access.');
   updates.marathonAccess={role:nextRole,
    active:body.data.marathonActive??old?.active??false,
    assignedAt:old?.assignedAt||now,assignedBy:old?.assignedBy||actor.uid,
    updatedAt:now,updatedBy:actor.uid};
  }
  if(body.data.displayName)await adminAuth.updateUser(uid,{displayName:body.data.displayName});
  await ref.update(updates);
  await audit(actor.uid,'marathon.account_updated',uid,{fields:Object.keys(body.data)});
  return json({ok:true,message:'Account and workspace roles updated.'});
 }catch(e){return fail(e);}
}
