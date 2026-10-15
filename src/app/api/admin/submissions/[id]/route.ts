import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,audit,safeText,sameOrigin,digest} from '@/lib/security';
import {normalizedIntake} from '@/lib/intake-policy';
import type {SubmissionStatus} from '@/lib/types';
import {automationSchema,defaultAutomations,formatNotification} from '@/lib/automations';
export const runtime='nodejs';
const stages:Record<SubmissionStatus,SubmissionStatus[]>={
 submitted:['under_review','needs_information','rejected'],
 under_review:['needs_information','accepted','rejected'],
 needs_information:['under_review','rejected'],
 accepted:['letter_issued','rejected'],
 letter_issued:['cdf_submitted','payment_verified','rejected'],
 cdf_submitted:['cdf_approved','rejected'],
 cdf_approved:['commission_paid'],payment_verified:['commission_paid'],
 commission_paid:[],rejected:[]
};
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin','admin','reviewer']);
  const {id}=await params;
  const body=await req.json();
  const status=body?.status as SubmissionStatus;
  const note=safeText(body?.note,1000);
  if(!Object.hasOwn(stages,status))throw new HttpError(400,'Invalid application status.');
  if(['cdf_approved','payment_verified','commission_paid'].includes(status)&&actor.role==='reviewer')
   throw new HttpError(403,'An administrator must verify funding and commission payments.');
  const ref=db.collection('submissions').doc(id);
  const settingsDoc=await db.collection('settings').doc('operations').get();
  const settings=settingsDoc.data()||{};
  const automationDoc=await db.collection('settings').doc('automations').get();
  const parsedAutomations=automationSchema.safeParse(automationDoc.data()?.config);
  const automationConfig=parsedAutomations.success?parsedAutomations.data:defaultAutomations;
  const now=new Date().toISOString();
  await db.runTransaction(async tx=>{
   const intakeSnapshot=await tx.get(db.collection('settings').doc('intake'));
   const requiredPolicy=normalizedIntake(intakeSnapshot.data()?.policy);
   const snap=await tx.get(ref);
   if(!snap.exists)throw new HttpError(404,'Application not found.');
   const previous=snap.data()!;
   if(!stages[previous.status as SubmissionStatus]?.includes(status))
    throw new HttpError(400,'Invalid status transition. Refresh this application.');
   if(previous.formKind!=='student'&&['letter_issued','cdf_submitted','cdf_approved','payment_verified','commission_paid'].includes(status))
    throw new HttpError(400,'Funding, letters and enrollment are for student applications only.');
   const history=[...(previous.history||[]).slice(-80),{status,at:now,by:actor.uid,...(note?{note}:{})}];
   const changes:Record<string,unknown>={status,updatedAt:now,history};
   if(note)changes.internalNotes=[...(previous.internalNotes||[]).slice(-79),{body:note,at:now,by:actor.uid}];

   if(status==='payment_verified'||status==='cdf_approved'){
    const trigger=status==='payment_verified'?'payment':'cdf_approval';
    const evidence=safeText(trigger==='payment'?body?.enrollmentPaymentReference:body?.cdfReference,160);
    if(evidence.length<5)throw new HttpError(400,trigger==='payment'?'An independently verified enrollment payment reference is required.':'Official CDF approval reference is required.');
    // Reserve each official approval/payment transaction reference for one application.
    const verificationRef=db.collection('fundingVerifications').doc(digest(trigger+':'+evidence.toLowerCase()));
    const priorVerification=await tx.get(verificationRef);
    if(priorVerification.exists && priorVerification.data()?.submissionId!==id)throw new HttpError(409,'This funding evidence reference has already been used for another application.');
    if(trigger==='payment'){
     if(body?.enrollmentConfirmed!==true)throw new HttpError(400,'Confirm that enrollment is successful and the verified payment satisfies the institution payment requirement.');
     const paid=Number(body?.enrollmentPaymentAmount);
     if(!Number.isFinite(paid)||paid<=0||paid>10000000)throw new HttpError(400,'Enter the verified amount the student paid (ZMW).');
     const minimum=Number(settings.minimumEnrollmentPayment||0);
     if(previous.agentId && (!Number.isFinite(minimum)||minimum<=0||paid<minimum))throw new HttpError(400,'An agent referral commission requires a configured minimum successful-enrollment payment, verified in full.');
     changes.paymentVerification={reference:evidence,amount:paid,currency:'ZMW',verifiedBy:actor.uid,verifiedAt:now};
     changes.fundingMethod='self_funded';changes.fundingStatus='enrollment_payment_verified';
    }else{
     const required=requiredPolicy.cdfRequiredDocuments;
     if(!required.length)throw new HttpError(400,'Configure mandatory CDF documents before approving sponsorship.');
     const missing=required.filter(d=>!previous.documents?.[d.id]?.path||!previous.documents?.[d.id]?.verifiedAt);
     if(missing.length)throw new HttpError(400,'Missing or unverified CDF documents: '+missing.map(d=>d.label).join(', ').slice(0,350));
     changes.cdfVerification={reference:evidence,verifiedBy:actor.uid,verifiedAt:now,fundingMethod:'cdf',documentChecklist:required.map(d=>d.id)};
     changes.fundingMethod='cdf';changes.fundingStatus='government_approval_verified';
    }
    if(previous.agentId){
     if(body?.referralVerified!==true)throw new HttpError(400,'Independently verify the original agent referral before commission is reserved.');
     const rate=Number(trigger==='payment'?settings.commissionAmountPaid??settings.commissionAmount:settings.commissionAmountCdf??settings.commissionAmount);
     if(!Number.isFinite(rate)||rate<=0||rate>50000)throw new HttpError(400,'Configure an appropriate commission rate before approving the referral.');
     changes.referralVerified={by:actor.uid,at:now};
     changes.commission={amount:rate,currency:'ZMW',trigger,approvedAt:now};
    }
   }
   if(['payment_verified','cdf_approved'].includes(status)){
    const trigger=status==='payment_verified'?'payment':'cdf_approval';
    const source=safeText(trigger==='payment'?body?.enrollmentPaymentReference:body?.cdfReference,160);
    tx.create(db.collection('fundingVerifications').doc(digest(trigger+':'+source.toLowerCase())),{
     submissionId:id,kind:trigger,reference:source,verifiedBy:actor.uid,verifiedAt:now
    });
   }
    if(status==='commission_paid'){
    if(!previous.agentId||!previous.commission||previous.commission.paidAt)throw new HttpError(400,'No outstanding commission exists for this application.');
    const paymentReference=safeText(body?.paymentReference,160);
    if(paymentReference.length<5)throw new HttpError(400,'A verified commission transfer reference is required.');
    changes.commission={...previous.commission,paidAt:now,paymentReference};
    tx.create(db.collection('commissionPayments').doc(id),{
     submissionId:id,agentId:previous.agentId,amount:previous.commission.amount,
     currency:'ZMW',trigger:previous.commission.trigger||'cdf_approval',
     paymentReference,recordedAt:now,recordedBy:actor.uid
    });
   }
   tx.update(ref,changes);
   // In-app event queue is part of the same transaction as the status change.
   // No email/SMS or money transfer is initiated here.
   for(const rule of automationConfig.rules.filter(r=>r.enabled&&r.event===status)){
    if(rule.recipient==='agent'&&!previous.agentId)continue;
    tx.create(db.collection('notificationOutbox').doc(),{
     kind:'application_status',submissionId:id,reference:String(previous.reference||''),
     event:status,recipient:rule.recipient,recipientUid:rule.recipient==='agent'?previous.agentId:null,
     title:rule.name,message:formatNotification(rule.template,String(previous.reference||'')),
     state:'pending',createdAt:now
    });
   }
  });
  await audit(actor.uid,'application.status_changed',id,{status});
  return json({ok:true});
 }catch(error){return fail(error);}
}
