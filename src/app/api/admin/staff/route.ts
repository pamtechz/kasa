import {adminAuth,db} from '@/lib/firebase-admin';
import {requirePermission,audit,operator,safeText,sameOrigin} from '@/lib/security';
import {fail,HttpError,json} from '@/lib/errors';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  await requirePermission(req,'staff.manage');
  const result=await db.collection('profiles').limit(300).get();
  return json({staff:result.docs.filter(d=>['super_admin','admin','reviewer'].includes(String(d.data().role))).map(d=>{
   const x=d.data();return {uid:d.id,email:x.email,displayName:x.displayName,role:x.role,active:x.active};
  })});
 }catch(e){return fail(e);}
}
export async function POST(req:Request){
 try{
  sameOrigin(req);const actor=await requirePermission(req,'staff.manage');
  const body=await req.json();
  const email=safeText(body.email,240).toLowerCase();
  const role=body.role;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['admin','reviewer'].includes(role))
   throw new HttpError(400,'Use a verified email and a permitted staff role.');
  const user=await adminAuth.getUserByEmail(email).catch(()=>null);
  if(!user||!user.emailVerified)throw new HttpError(400,'The invited staff member must first register and verify their email.');
  if(user.uid===actor.uid)throw new HttpError(403,'Self-service role changes are not permitted.');
  const ref=db.collection('profiles').doc(user.uid);
  const existing=await ref.get();
  if(existing.exists&&['agent','super_admin'].includes(existing.data()?.role))
   throw new HttpError(409,'Existing agent or super-admin accounts cannot be reassigned here.');
  await ref.set({uid:user.uid,email,displayName:user.displayName||email.split('@')[0],role,active:true,updatedAt:new Date().toISOString()},{merge:true});
  await audit(actor.uid,'staff.assigned',user.uid,{role});
  return json({ok:true,uid:user.uid},201);
 }catch(e){return fail(e);}
}
