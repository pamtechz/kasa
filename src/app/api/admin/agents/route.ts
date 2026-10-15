import {db,adminAuth} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,audit,sameOrigin,safeText} from '@/lib/security';
export const runtime='nodejs';
export async function GET(req:Request){
 try{await operator(req,['super_admin','admin','reviewer']);
  const q=await db.collection('profiles').where('role','==','agent').limit(300).get();
  return json({agents:q.docs.map(d=>({uid:d.id,...d.data()}))});
 }catch(e){return fail(e);}
}
export async function POST(req:Request){
 try{
  sameOrigin(req);const actor=await operator(req,['super_admin','admin']);const body=await req.json();
  const email=safeText(body.email,250).toLowerCase();
  const district=safeText(body.district,120);
  const applicationId=safeText(body.applicationId,60);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||district.length<2||!/^[a-f0-9-]{36}$/i.test(applicationId))throw new HttpError(400,'An approved application, verified email and district are required.');
  const applicationRef=db.collection('submissions').doc(applicationId);
  const applicationSnap=await applicationRef.get();
  const submission=applicationSnap.data();
  if(!submission||submission.formKind!=='agent'||submission.status!=='accepted')throw new HttpError(403,'Recruitment application must first be reviewed and accepted.');
  if(submission.assignedAgentUid)throw new HttpError(409,'This recruitment application has already been assigned.');
  const emailField=submission.formSnapshot?.sections?.flatMap((s:{fields:{id:string;type:string}[]})=>s.fields).find((f:{type:string})=>f.type==='email');
  const submittedEmail=emailField?String(submission.answers?.[emailField.id]||'').toLowerCase():'';
  if(email!==submittedEmail)throw new HttpError(403,'Registered account email must match the accepted recruitment application.');
  let user;
  try{user=await adminAuth.getUserByEmail(email);}catch{throw new HttpError(404,'The applicant must register a Firebase Authentication account first.');}
  if(!user.emailVerified)throw new HttpError(400,'The agent must verify their email address before appointment.');
  const ref=db.collection('profiles').doc(user.uid);
  const snap=await ref.get();
  if(snap.exists&&snap.data()?.role!=='agent')throw new HttpError(409,'Existing staff account cannot be converted to an agent here.');
  const agentCode= snap.data()?.agentCode ?? `KASA-${user.uid.slice(0,10).toUpperCase()}`;
  const active=body.active!==false;
  await db.runTransaction(async tx=>{
   const a=await tx.get(applicationRef),profile=await tx.get(ref);
   if(a.data()?.assignedAgentUid)throw new HttpError(409,'Recruitment application is already assigned.');
   if(profile.exists&&profile.data()?.role!=='agent')throw new HttpError(409,'Account already has another staff role.');
   tx.set(ref,{uid:user.uid,email,displayName:user.displayName||email.split('@')[0],role:'agent',active,agentCode,district,updatedAt:new Date().toISOString()},{merge:true});
   tx.update(applicationRef,{assignedAgentUid:user.uid,assignedAt:new Date().toISOString()});
  });
  await audit(actor.uid,'agent.assigned',user.uid,{district,active,applicationId});
  return json({uid:user.uid,agentCode},201);
 }catch(e){return fail(e);}
}
