import {adminAuth,db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity,requireMarathon} from '@/lib/marathon';
import type {Profile} from '@/lib/types';
export const runtime='nodejs';
/** Exact-email lookup only. Never expose the full school directory in Marathon. */
export async function GET(req:Request){
 try{
  const actor=await marathonIdentity(req);requireMarathon(actor,'super');
  const email=new URL(req.url).searchParams.get('email')?.trim().toLowerCase()||'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>240)
   throw new HttpError(400,'Enter a full email address to search.');
  const authUser=await adminAuth.getUserByEmail(email).catch(e=>{
   if((e as {code?:string}).code==='auth/user-not-found')return null;throw e;
  });
  if(!authUser)return json({found:false});
  const snap=await db.collection('profiles').doc(authUser.uid).get();
  const p=snap.data() as Profile|undefined;
  if(!p)return json({found:false,needsReconciliation:true,message:'An Auth account exists without an approved School profile. Contact the administrator; no duplicate will be created.'});
  return json({found:true,member:{uid:authUser.uid,email:p.email,displayName:p.displayName,
   schoolRole:p.role,active:p.active,marathonRole:p.marathonAccess?.role||null,
   marathonActive:p.marathonAccess?.active===true,emailVerified:authUser.emailVerified,
   eligible:p.active===true&&p.role!=='student'&&p.role!=='super_admin'},
   message:p.role==='student'?'School students cannot be added to Marathon operations.':p.role==='super_admin'?'School super administrator already has Marathon access.':null});
 }catch(e){return fail(e);}
}
