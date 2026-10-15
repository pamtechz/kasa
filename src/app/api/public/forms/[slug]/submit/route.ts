import type {NextRequest} from 'next/server';
import {db,storage,adminAuth} from '@/lib/firebase-admin';
import {fail,HttpError,json} from '@/lib/errors';
import {cleanAnswers,applicantFingerprint} from '@/lib/schema';
import {digest,newId,rateLimit,requireAppCheck,sameOrigin} from '@/lib/security';
import type {FormSchema} from '@/lib/types';
import type {Attachment} from '@/lib/schema';
import {loadIntake} from '@/lib/intake-server';
import {intakeWindow,normalizedIntake} from '@/lib/intake-policy';
import {automationSchema,defaultAutomations,formatNotification} from '@/lib/automations';
export const runtime='nodejs';
export async function POST(req:NextRequest,{params}:{params:Promise<{slug:string}>}){
 try{
  sameOrigin(req);
  await requireAppCheck(req);
  await rateLimit(req,'submission',8,10);
  const {slug}=await params;
  const raw=await req.text();
  if(raw.length>40000)throw new HttpError(413,'Submission exceeds the permitted size.');
  let payload:unknown;
  try{payload=JSON.parse(raw);}catch{throw new HttpError(400,'Invalid application data.');}
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new HttpError(400,'Invalid application.');
  const body=payload as Record<string,unknown>;
  const q=await db.collection('forms').where('slug','==',slug).limit(1).get();
  const formDoc=q.docs[0];
  if(!formDoc||!formDoc.data().published)throw new HttpError(404,'This form is closed.');
  const form={...formDoc.data(),id:formDoc.id} as FormSchema;
  const state=intakeWindow(await loadIntake(),slug);
  if(!state.open)throw new HttpError(403,state.reason);
  if(body.formVersion!==form.version)throw new HttpError(409,'Form has changed. Refresh to submit the current version.');
  const answers=cleanAnswers(form,body.answers);
  let applicantUid:string|null=null;
  const bearer=req.headers.get('authorization')||'';
  if(form.kind==='student'&&bearer){
   if(!bearer.startsWith('Bearer '))throw new HttpError(401,'Invalid student sign-in session.');
   const claims=await adminAuth.verifyIdToken(bearer.slice(7),true).catch(()=>null);
   if(!claims?.email_verified||!claims.email)throw new HttpError(401,'Sign in with a verified email before submitting from your account.');
   const field=form.sections.flatMap(s=>s.fields).find(x=>x.type==='email');
   const answerEmail=field?String(answers[field.id]||'').trim().toLowerCase():'';
   if(answerEmail!==claims.email.toLowerCase())throw new HttpError(403,'The application email must match your verified account email.');
   applicantUid=claims.uid;
  }

  let agentId:string|null=null;
  if(form.kind==='student'&&body.agentCode!==undefined && body.agentCode!==null && body.agentCode!==''){
   const referralSettings=await db.collection('settings').doc('operations').get();
   if(referralSettings.data()?.referralsEnabled===false)throw new HttpError(400,'The referral program is currently paused.');
   if(typeof body.agentCode!=='string'||!/^[A-Z0-9-]{5,24}$/.test(body.agentCode))throw new HttpError(400,'Invalid agent referral code.');
   const agent=await db.collection('profiles').where('agentCode','==',body.agentCode).limit(1).get();
   if(agent.empty||agent.docs[0].data().role!=='agent'||!agent.docs[0].data().active)throw new HttpError(400,'Agent code is not active.');
   agentId=agent.docs[0].id;
  }
  // Validate that each referenced private upload exists, is small and has the claimed MIME type.
  const attachments=Object.values(answers).filter((v):v is Attachment=>Boolean(v&&typeof v==='object'&&!Array.isArray(v)&&'path' in v));
  for(const a of attachments){
   const [exists]=await storage.bucket().file(a.path).exists();
   if(!exists)throw new HttpError(400,'An attachment could not be verified. Please upload it again.');
   const [meta]=await storage.bucket().file(a.path).getMetadata();
   if(Number(meta.size)>4*1024*1024||meta.contentType!==a.contentType)throw new HttpError(400,'Attachment validation failed.');
  }
  const autoDoc=await db.collection('settings').doc('automations').get();
  const autoParsed=automationSchema.safeParse(autoDoc.data()?.config);
  const automationConfig=autoParsed.success?autoParsed.data:defaultAutomations;
  const fingerprint=applicantFingerprint(form.sections.flatMap(s=>s.fields),answers);
  const fingerprintId=fingerprint?digest(`${form.id}:${fingerprint}`):null;
  const id=newId();
  const reference=`KASA-${new Date().getFullYear()}-${id.slice(0,8).toUpperCase()}`;
  const now=new Date().toISOString();
  await db.runTransaction(async tx=>{
   // Read form and window again inside transaction, preventing a concurrent closure race.
   const intakeRef=db.collection('settings').doc('intake');
   const [intakeDoc,currentForm]=await Promise.all([tx.get(intakeRef),tx.get(formDoc.ref)]);
   const currentWindow=intakeWindow(normalizedIntake(intakeDoc.data()?.policy),slug);
   if(!currentWindow.open)throw new HttpError(403,currentWindow.reason);
   if(!currentForm.exists||!currentForm.data()?.published||currentForm.data()?.version!==form.version)throw new HttpError(409,'Form has changed or closed. Refresh before applying.');
   // Firestore transactions require all reads before any writes.
   const duplicateRef=fingerprintId?db.collection('applicationDedupe').doc(fingerprintId):null;
   const duplicate=duplicateRef?await tx.get(duplicateRef):null;
   if(duplicate?.exists)throw new HttpError(409,'An application with this contact has already been submitted. Contact KASA for assistance.');
   const fileRefs=attachments.map(a=>db.collection('fileClaims').doc(digest(a.path)));
   const existing=await Promise.all(fileRefs.map(ref=>tx.get(ref)));
   if(existing.some(s=>s.exists))throw new HttpError(409,'An attachment has already been used. Upload a new copy.');
   if(duplicateRef)tx.create(duplicateRef,{submissionId:id,formId:form.id,createdAt:now});
   fileRefs.forEach((ref,index)=>tx.create(ref,{submissionId:id,path:attachments[index].path}));
   tx.create(db.collection('submissions').doc(id),{
    reference,formId:form.id,formTitle:form.title,formKind:form.kind,formVersion:form.version,
    status:'submitted',answers,agentId,applicantUid,formSnapshot:{title:form.title,slug:form.slug,sections:form.sections,version:form.version},submittedAt:now,updatedAt:now,history:[{at:now,status:'submitted',by:'applicant'}]
   });
   for(const rule of automationConfig.rules.filter(r=>r.enabled&&r.event==='submitted')){
    if(rule.recipient==='agent'&&!agentId)continue;
    tx.create(db.collection('notificationOutbox').doc(),{
     kind:'application_status',submissionId:id,reference,event:'submitted',
     recipient:rule.recipient,recipientUid:rule.recipient==='agent'?agentId:null,
     title:rule.name,message:formatNotification(rule.template,reference),
     state:'pending',createdAt:now
    });
   }
  });
  return json({reference,message:'Your application has been submitted successfully.'},201);
 }catch(e){return fail(e);}
}
