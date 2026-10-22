import {db,adminAuth} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,audit,sameOrigin,safeText} from '@/lib/security';
import {getGeneralCache,setGeneralCache,invalidateGeneralCache} from '@/lib/server-cache';
export const runtime='nodejs';

export async function GET(req:Request){
 try{await operator(req,['super_admin','admin','reviewer']);
  const cached = getGeneralCache<{agents: any[]}>('agents');
  if (cached) return json(cached);
  const q=await db.collection('profiles').where('role','==','agent').limit(300).get();
  const res = {agents:q.docs.map(d=>({uid:d.id,...d.data()}))};
  setGeneralCache('agents', res);
  return json(res);
 }catch(e){return fail(e);}
}

export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin','admin']);
  const body=await req.json();
  const email=safeText(body.email,250).toLowerCase();
  const displayName=safeText(body.displayName||body.name,120);
  const district=safeText(body.district,120);
  const applicationId=safeText(body.applicationId,60);

  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||district.length<2) {
   throw new HttpError(400,'A valid email address and district (at least 2 characters) are required.');
  }

  // Assignment requires an existing Firebase identity verified by its owner.
  // Never create a privileged profile attached to a made-up Auth UID.
  let user;
  try{user=await adminAuth.getUserByEmail(email);}
  catch(error){
   if((error as {code?:string})?.code==='auth/user-not-found')
    throw new HttpError(409,'The agent must register and verify their email before role assignment.');
   throw error;
  }
  if(!user.emailVerified)throw new HttpError(403,'The agent must verify their email first.');
  const uid=user.uid;
  const ref=db.collection('profiles').doc(uid);
  const snap=await ref.get();
  if(snap.exists&&snap.data()?.role&&snap.data()?.role!=='agent') {
   throw new HttpError(409,'Existing staff account cannot be converted to an agent.');
  }

  const customCode = safeText(body.agentCode, 30).toUpperCase();
  const agentCode = customCode || snap.data()?.agentCode || `KASA-${uid.slice(0,8).toUpperCase()}`;
  const active = body.active!==false;
  const now = new Date().toISOString();

  if(applicationId && /^[a-f0-9-]{36}$/i.test(applicationId)){
   const applicationRef=db.collection('submissions').doc(applicationId);
   const applicationSnap=await applicationRef.get();
   const submission=applicationSnap.data();
   if(submission && submission.formKind==='agent'){
    await applicationRef.update({assignedAgentUid:uid,assignedAt:now});
   }
  }

  await ref.set({
   uid,
   email,
   displayName: displayName || user?.displayName || email.split('@')[0],
   role:'agent',
   active,
   agentCode,
   district,
   province: safeText(body.province, 100),
   constituency: safeText(body.constituency, 100),
   ward: safeText(body.ward, 100),
   updatedAt: now
  },{merge:true});

  invalidateGeneralCache('agents');
  await audit(actor.uid,'agent.assigned',uid,{district,active,applicationId,agentCode});
  return json({uid,agentCode},201);
 }catch(e){return fail(e);}
}
