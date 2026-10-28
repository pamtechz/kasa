import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,audit,safeText,sameOrigin,digest} from '@/lib/security';
import {normalizedIntake} from '@/lib/intake-policy';
import {readApprovedFeeQuote} from '@/lib/approved-fee-quote';
import {commissionDecision} from '@/lib/commission-eligibility';
import type {SubmissionStatus} from '@/lib/types';
import {automationSchema,defaultAutomations,formatNotification} from '@/lib/automations';
import {invalidateSubmissionsCache} from '@/lib/server-cache';
export const runtime='nodejs';
const stages:Record<SubmissionStatus,SubmissionStatus[]>={
 submitted:['under_review','needs_information','rejected'],
 under_review:['needs_information','accepted','rejected'],
 needs_information:['under_review','rejected'],
 accepted:['letter_issued','rejected'],
 letter_issued:['cdf_submitted','payment_verified','rejected'],
 cdf_submitted:['cdf_approved','rejected'],
 cdf_approved:['cdf_funds_received'],cdf_funds_received:['commission_paid'],payment_verified:['commission_paid'],
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
  if(['cdf_approved','cdf_funds_received','payment_verified','commission_paid'].includes(status)&&actor.role==='reviewer')
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
   if(status==='letter_issued'&&!readApprovedFeeQuote(previous.feeQuote))
    throw new HttpError(409,'Document an approved application-specific fee quote before issuing a student acceptance letter.');
   if(previous.formKind!=='student'&&['letter_issued','cdf_submitted','cdf_approved','cdf_funds_received','payment_verified','commission_paid'].includes(status))
    throw new HttpError(400,'Funding, letters and enrollment are for student applications only.');
   const history=[...(previous.history||[]).slice(-80),{status,at:now,by:actor.uid,...(note?{note}:{})}];
   const changes:Record<string,unknown>={status,updatedAt:now,history};
   if(note)changes.internalNotes=[...(previous.internalNotes||[]).slice(-79),{body:note,at:now,by:actor.uid}];

   // Applications and offer letters are admission decisions, never payment evidence.
   const quote=readApprovedFeeQuote(previous.feeQuote);
   if(['cdf_submitted','cdf_approved','cdf_funds_received','payment_verified'].includes(status)&&!quote)
    throw new HttpError(409,'Reconcile and approve the exact student fee quotation before any funding milestone.');
   if(['cdf_submitted','cdf_approved','cdf_funds_received'].includes(status)&&previous.fundingMethod!=='cdf')
    throw new HttpError(409,'CDF milestones require an application registered for CDF sponsorship.');
   if(status==='payment_verified'&&previous.fundingMethod!=='self_funded')
    throw new HttpError(409,'Tuition enrollment verification is only for self-funded applications.');
   if(['cdf_submitted','payment_verified','cdf_approved','cdf_funds_received'].includes(status)&&previous.autoApproved===true&&
     !previous.history?.some((entry:{status?:string;by?:string})=>entry.status==='accepted'&&entry.by!=='system_auto_approval'))
    throw new HttpError(409,'Legacy automatically issued offers must undergo an independent admissions review before funding can be confirmed.');
   if(status==='payment_verified'||status==='cdf_approved'||status==='cdf_funds_received'){
    const kind=status==='payment_verified'?'payment':status==='cdf_approved'?'cdf_approval':'cdf_disbursement';
    const evidence=safeText(kind==='payment'?body?.enrollmentPaymentReference:
      kind==='cdf_approval'?body?.cdfReference:body?.cdfGovernmentPaymentReference,160);
    if(evidence.length<5)throw new HttpError(400,'Enter the independently verified receipt or government reference.');
    const verificationRef=db.collection('fundingVerifications').doc(digest(kind+':'+evidence.toLowerCase()));
    const priorVerification=await tx.get(verificationRef);
    if(priorVerification.exists)throw new HttpError(409,'Funding evidence reference already recorded. Reconcile this application rather than reusing it.');
    if(status==='payment_verified'){
     if(body?.enrollmentConfirmed!==true)throw new HttpError(400,'Confirm successful student enrollment separately from payment collection.');
     const paid=Number(body?.enrollmentPaymentAmount);
     const recorded=Number(previous.paymentVerification?.amount);
     if(!Number.isFinite(paid)||!Number.isFinite(recorded)||!previous.paymentVerification?.recordedAt||
       paid<=0||Math.round(paid*100)!==Math.round(quote!.total*100)||
       Math.round(recorded*100)!==Math.round(quote!.total*100)||
       evidence!==previous.paymentVerification?.reference)
      throw new HttpError(409,'Full approved programme fees must first be recorded as real finance receipts. Use the recorded final receipt and exact reconciled total; no direct payment declarations.');
     changes.paymentVerification={...previous.paymentVerification,reference:evidence,amount:paid,currency:'ZMW',
      verifiedBy:actor.uid,verifiedAt:now,verificationPending:false};
     changes.fundingStatus='enrollment_payment_verified';
    }else if(status==='cdf_approved'){
     const required=requiredPolicy.cdfRequiredDocuments;
     if(!required.length)throw new HttpError(409,'Configure required CDF documents before approval.');
     const missing=required.filter(d=>!previous.documents?.[d.id]?.path||!previous.documents?.[d.id]?.verifiedAt);
     if(missing.length)throw new HttpError(409,'CDF supporting documents missing or not verified: '+missing.map(x=>x.label).join(', '));
     const agency=safeText(body?.cdfApprovingAuthority,160);
     if(agency.length<5)throw new HttpError(400,'Name the government/CDF authority that issued and confirmed the approval notice.');
     changes.cdfVerification={reference:evidence,verifiedBy:actor.uid,verifiedAt:now,
       approvingAuthority:agency,fundingMethod:'cdf',documentChecklist:required.map(d=>d.id)};
     changes.fundingStatus='government_approval_verified';
     // No commission is created from an approval letter alone.
    }else{
     if(!previous.cdfVerification?.verifiedAt||!previous.cdfVerification?.reference)
      throw new HttpError(409,'The government approval must be independently verified first.');
     if(body?.cdfEnrollmentConfirmed!==true)
      throw new HttpError(400,'Confirm that the funded student has actually enrolled.');
     const bankReference=safeText(body?.cdfBankReceiptReference,160);
     if(bankReference.length<5||bankReference.toLowerCase()===evidence.toLowerCase())
      throw new HttpError(400,'Enter the separate KASA bank receipt/remittance reference evidencing funds received.');
     const paid=Number(body?.cdfAmountReceived);
     if(!Number.isFinite(paid)||Math.round(paid*100)!==Math.round(quote!.total*100))
      throw new HttpError(409,'The full approved fee must actually be received from government and reconciled before enrollment or commission is confirmed.');
     const bankRef=db.collection('fundingVerifications').doc(digest('cdf_bank:'+bankReference.toLowerCase()));
     if((await tx.get(bankRef)).exists)throw new HttpError(409,'Government remittance bank receipt has already been used.');
     tx.create(bankRef,{submissionId:id,kind:'cdf_bank_receipt',reference:bankReference,amount:paid,verifiedAt:now,verifiedBy:actor.uid});
     changes.cdfDisbursement={governmentReference:evidence,bankReference,amount:paid,
      verifiedBy:actor.uid,verifiedAt:now,enrollmentConfirmed:true};
     changes.fundingStatus='government_funds_received_verified';
    }
    tx.create(verificationRef,{submissionId:id,kind,reference:evidence,verifiedAt:now,verifiedBy:actor.uid,
     ...(status==='cdf_funds_received'?{amount:Number(body.cdfAmountReceived)}:{})});
    if(previous.agentId&&status!=='cdf_approved'){
     if(body?.referralVerified!==true)throw new HttpError(400,'Independently verify agent attribution before earning commission.');
     const rate=Number(kind==='payment'?settings.commissionAmountPaid:settings.commissionAmountCdf);
     if(!Number.isFinite(rate)||rate<=0||rate>50000)
      throw new HttpError(409,'An explicit positive commission rate for this funding path must be approved in Settings. No fallback rate is allowed.');
     changes.referralVerified={by:actor.uid,at:now};
     changes.commission={amount:rate,currency:'ZMW',trigger:kind==='payment'?'payment':'cdf_disbursement',approvedAt:now};
    }
   }
    if(status==='commission_paid'){
    if(!previous.agentId||!previous.commission||previous.commission.paidAt||!commissionDecision(previous).eligible)
     throw new HttpError(409,'No eligible funded, fully enrolled and independently verified unpaid commission exists for this application.');
    const paymentReference=safeText(body?.paymentReference,160);
    if(paymentReference.length<5)throw new HttpError(400,'A verified commission transfer reference is required.');
    const payoutRef=db.collection('commissionPayoutReferences').doc(digest(paymentReference.toLowerCase()));
    if((await tx.get(payoutRef)).exists)throw new HttpError(409,'This commission transfer reference has already been used.');
    tx.create(payoutRef,{submissionId:id,agentId:previous.agentId,recordedAt:now,recordedBy:actor.uid});
    changes.commission={...previous.commission,paidAt:now,paymentReference};
    tx.create(db.collection('commissionPayments').doc(id),{
     submissionId:id,agentId:previous.agentId,amount:previous.commission.amount,
     currency:'ZMW',trigger:previous.commission.trigger,
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
  invalidateSubmissionsCache();
  await audit(actor.uid,'application.status_changed',id,{status});
  return json({ok:true});
 }catch(error){return fail(error);}
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin','admin']);
  const {id}=await params;
  const ref=db.collection('submissions').doc(id);
  const snap=await ref.get();
  if(!snap.exists)throw new HttpError(404,'Application not found.');
  if(snap.data()?.paymentVerification?.recordedAt||snap.data()?.cdfVerification?.verifiedAt||snap.data()?.commission||
   ['cdf_funds_received','payment_verified','commission_paid'].includes(String(snap.data()?.status)))
   throw new HttpError(409,'Cannot delete a student finance, government approval, enrollment or commission audit record. Use audited reconciliation.');
  await ref.delete();
  invalidateSubmissionsCache();
  await audit(actor.uid,'application.deleted',id,{reference:snap.data()?.reference});
  return json({ok:true});
 }catch(e){return fail(e);}
}
