import {db} from '@/lib/firebase-admin';
import {operator,safeText,sameOrigin,digest} from '@/lib/security';
import {readApprovedFeeQuote} from '@/lib/approved-fee-quote';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';

/** At most one early advance per referred student. This never marks the referral
 * as earned or enrolled. All monetary values and proof are computed server side. */
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin','admin']);
  const body=await req.json();
  const submissionId=safeText(body.submissionId,64);
  const transferReference=safeText(body.transactionId,160);
  const reason=safeText(body.reason,600);
  const amount=body.amount;
  if(!/^[A-Za-z0-9_-]{8,64}$/.test(submissionId)||transferReference.length<5||reason.length<15)
   throw new HttpError(400,'Application, transfer transaction ID and reason (15+ characters) are required.');
  if(typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||
   Math.abs(amount*100-Math.round(amount*100))>0.000001)
   throw new HttpError(400,'Choose a positive advance amount to two decimal places.');
  const requestedMinor=Math.round(amount*100),now=new Date().toISOString();
  const subRef=db.collection('submissions').doc(submissionId);
  const advanceRef=db.collection('commissionAdvances').doc(submissionId);
  const receiptRef=db.collection('commissionReceipts').doc(submissionId+'--advance');
  const proofRef=db.collection('commissionPayoutReferences').doc(digest(transferReference.toLowerCase()));
  const settingRef=db.collection('settings').doc('operations');
  let advanceLimitMinor=0;
  await db.runTransaction(async tx=>{
   const [snap,old,receipt,proof,policy]=await Promise.all([
    tx.get(subRef),tx.get(advanceRef),tx.get(receiptRef),tx.get(proofRef),tx.get(settingRef)]);
   const submission=snap.data(),settings=policy.data()||{};
   if(!submission||submission.formKind!=='student'||submission.fundingMethod!=='self_funded'||
    !['letter_issued','payment_verified'].includes(String(submission.status)))
    throw new HttpError(409,'Early advances require a self-funded referred student with an accepted offer.');
   if(!submission.agentId||submission.agentId===submission.applicantUid)
    throw new HttpError(409,'A genuine non-self referral is required.');
   const existingRequest=await tx.get(db.collection('payoutReservations').doc(submissionId));
   if(existingRequest.exists)throw new HttpError(409,'An existing payout request must be resolved before an early advance.');
   if(old.exists||receipt.exists||proof.exists)
    throw new HttpError(409,'An advance or this transfer reference is already recorded.');
   if(submission.commission?.paidAt)throw new HttpError(409,'This commission was already paid.');
   const quote=readApprovedFeeQuote(submission.feeQuote);
   if(!quote||quote.total<=0)throw new HttpError(409,'An approved fee quote is required.');
   const paid=Number(submission.paymentVerification?.amount||0),rate=Number(settings.commissionAmountPaid);
   if(!Number.isFinite(paid)||paid<=0||!submission.paymentVerification?.recordedAt||
    !submission.paymentVerification?.reference||!Number.isFinite(rate)||rate<=0||rate>50000)
    throw new HttpError(409,'Verified student installments and an approved commission rate are required.');
   const paidMinor=Math.round(paid*100),feeMinor=Math.round(quote.total*100),rateMinor=Math.round(rate*100);
   if(paidMinor>=feeMinor)throw new HttpError(409,'Full payment recorded; use normal funded-enrollment commission verification.');
   if(paidMinor>feeMinor)throw new HttpError(409,'Fee ledger needs reconciliation.');
   const referrer=await tx.get(db.collection('profiles').doc(String(submission.agentId)));
   if(!referrer.exists||referrer.data()?.active!==true||!['agent','student'].includes(String(referrer.data()?.role)))
    throw new HttpError(409,'Referrer must be an active registered student or agent.');
   if(submission.referralVerified?.by===undefined&&body.referralVerified!==true)
    throw new HttpError(400,'Confirm you independently verified referral attribution.');
   // Limit advance to the paid fraction of the configured commission.
   advanceLimitMinor=Math.floor(rateMinor*paidMinor/feeMinor);
   if(requestedMinor>advanceLimitMinor||advanceLimitMinor<1)
    throw new HttpError(409,'Advance cannot exceed the pro-rated commission backed by recorded tuition.');
   const record={submissionId,recipientUid:submission.agentId,amountMinor:requestedMinor,
    fullRateMinor:rateMinor,studentPaidMinor:paidMinor,feeMinor,transactionId:transferReference,
    reason,recordedBy:actor.uid,recordedAt:now,status:'recorded'};
   tx.create(advanceRef,record);
   tx.create(proofRef,{submissionId,agentId:submission.agentId,kind:'commission_advance',recordedAt:now,recordedBy:actor.uid});
   tx.create(receiptRef,{submissionId,reference:String(submission.reference||submissionId),
    recipientUid:submission.agentId,amountMinor:requestedMinor,currency:'ZMW',
    transactionId:transferReference,trigger:'advance',recordedBy:actor.uid,recordedAt:now,
    status:'awaiting_confirmation',confirmedAt:null,disputedAt:null,createdAt:now,updatedAt:now,
    payoutType:'advance',originalCommissionRateMinor:rateMinor});
   tx.create(db.collection('auditLogs').doc(),{
    actor:actor.uid,action:'commission.advance_recorded',target:submissionId,
    details:{amountMinor:requestedMinor,limitMinor:advanceLimitMinor,reason},at:now});
   tx.create(db.collection('notificationOutbox').doc(),{
    kind:'commission_payout_receipt',event:'commission_advance_recorded',recipient:'agent',
    recipientUid:submission.agentId,reference:String(submission.reference||submissionId),
    submissionId,title:'Confirm your commission advance',
    message:'KASA recorded an early commission advance. Check the amount and transaction ID and confirm or dispute it in your portal.',
    state:'pending',createdAt:now});
  });
  return json({ok:true,advanceMinor:requestedMinor,limitMinor:advanceLimitMinor,
   receiptId:submissionId+'--advance',message:'Commission advance recorded with private recipient confirmation. It will reduce any later final commission payment.'},201);
 }catch(e){return fail(e);}
}

export async function GET(req:Request){
 try{
  await operator(req,['super_admin','admin']);
  const policy=(await db.collection('settings').doc('operations').get()).data()||{};
  const rate=Number(policy.commissionAmountPaid)||0;
  const rows:Array<{submissionId:string;reference:string;student:string;recipientUid:string;
   paidMinor:number;feeMinor:number;limitMinor:number;advanceMinor:number;
   advanceTransactionId:string|null;fundingStatus:string}>=[];
  let cursor:FirebaseFirestore.QueryDocumentSnapshot|undefined,partial=false;
  for(let page=0;page<40;page++){
   let q=db.collection('submissions').where('formKind','==','student').orderBy('__name__').limit(250);
   if(cursor)q=q.startAfter(cursor);
   const docs=await q.get();
   for(const doc of docs.docs){
    const data=doc.data();
    if(!data.agentId||data.agentId===data.applicantUid||data.fundingMethod!=='self_funded')continue;
    const quote=readApprovedFeeQuote(data.feeQuote);
    const paid=Number(data.paymentVerification?.amount||0);
    if(!quote||!Number.isFinite(paid)||paid<=0)continue;
    if(!['letter_issued','payment_verified'].includes(String(data.status)))continue;
    const paidMinor=Math.round(paid*100),feeMinor=Math.round(quote.total*100);
    if(feeMinor<=0||paidMinor<=0||paidMinor>feeMinor)continue;
    rows.push({submissionId:doc.id,reference:String(data.reference||doc.id),
     student:String(data.answers?.['full-name']||data.answers?.fullNames||'Student'),
     recipientUid:String(data.agentId),paidMinor,feeMinor,
     limitMinor:paidMinor<feeMinor&&rate>0?Math.floor(Math.round(rate*100)*paidMinor/feeMinor):0,
     advanceMinor:0,advanceTransactionId:null,fundingStatus:String(data.status)});
   }
   if(docs.size<250)break;
   cursor=docs.docs[docs.docs.length-1];
   if(page===39)partial=true;
  }
  // Read advance proofs only for scoped student applications.
  for(let i=0;i<rows.length;i+=100){
   const refs=rows.slice(i,i+100).map(row=>db.collection('commissionAdvances').doc(row.submissionId));
   const docs=await db.getAll(...refs);
   docs.forEach((doc,j)=>{
    if(doc.exists){
     rows[i+j].advanceMinor=Number(doc.data()?.amountMinor||0);
     rows[i+j].advanceTransactionId=String(doc.data()?.transactionId||'');
    }
   });
  }
  return json({rows,commissionRateMinor:Math.round(rate*100),partial,
   note:'Only admin-recorded early advances are shown. These are not earned commissions; actual transfers require provider evidence and recipient confirmation.'});
 }catch(e){return fail(e);}
}
