import {db} from '@/lib/firebase-admin';
import {operator,safeText,sameOrigin,digest} from '@/lib/security';
import {readApprovedFeeQuote} from '@/lib/approved-fee-quote';
import {advanceEntitlementMinor,commissionTotalMinor,commissionPolicyFromSettings,type CommissionMode} from '@/lib/commission-payment-policy';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';

/** Records a real, independently evidenced transfer. Does NOT send funds.
 * Each transfer has globally unique provider ID, its own receipt, and an atomic
 * cumulative amount cap. Admin policy is captured at the first transfer.
 */
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin','admin']);
  const body=await req.json();
  const submissionId=safeText(body.submissionId,64);
  const transactionId=safeText(body.transactionId,160),reason=safeText(body.reason,600);
  if(!/^[A-Za-z0-9_-]{8,64}$/.test(submissionId)||transactionId.length<5||reason.length<15||
   body.referralVerified!==true||body.paymentVerified!==true)
   throw new HttpError(400,'Application, verified referrer, verified bank transfer, transaction ID and reason are required.');
  if(typeof body.amount!=='number'||!Number.isFinite(body.amount)||body.amount<=0||
    Math.abs(body.amount*100-Math.round(body.amount*100))>0.000001)
   throw new HttpError(400,'Provide a positive amount to two decimal places.');
  const requestedMinor=Math.round(body.amount*100),now=new Date().toISOString();
  const appRef=db.collection('submissions').doc(submissionId);
  const advanceRef=db.collection('commissionAdvances').doc(submissionId);
  const proofRef=db.collection('commissionPayoutReferences').doc(digest(transactionId.trim().toLowerCase()));
  const receiptId=digest('commission_advance:'+submissionId+':'+transactionId.trim().toLowerCase());
  const receiptRef=db.collection('commissionReceipts').doc(receiptId);
  const settingsRef=db.collection('settings').doc('operations');
  const reservationRef=db.collection('payoutReservations').doc(submissionId);
  let newTotal=0,maxAllowed=0;
  await db.runTransaction(async tx=>{
   const [appDoc,old,proof,receipt,settingsDoc,reservation]=await Promise.all([
    tx.get(appRef),tx.get(advanceRef),tx.get(proofRef),tx.get(receiptRef),
    tx.get(settingsRef),tx.get(reservationRef)]);
   const app=appDoc.data(),settings=settingsDoc.data()||{};
   if(!app||app.formKind!=='student'||app.fundingMethod!=='self_funded'||
     !['letter_issued','payment_verified'].includes(String(app.status)))
    throw new HttpError(409,'A self-funded referred student with an accepted offer is required.');
   if(!app.agentId||app.agentId===app.applicantUid)
    throw new HttpError(409,'Missing or self referral cannot receive commission.');
   if(app.commission?.paidAt)throw new HttpError(409,'This commission has been settled.');
   if(reservation.exists)throw new HttpError(409,'Resolve the existing payout request first.');
   if(proof.exists||receipt.exists)throw new HttpError(409,'This provider transaction has already been recorded.');
   const quote=readApprovedFeeQuote(app.feeQuote);
   if(!quote||quote.total<=0)throw new HttpError(409,'Reconcile the approved fee quotation first.');
   const paid=Number(app.paymentVerification?.amount||0);
   if(!Number.isFinite(paid)||paid<=0||!app.paymentVerification?.recordedAt||
     !app.paymentVerification?.reference)
    throw new HttpError(409,'Finance must first record an independently verified tuition payment.');
   const paidMinor=Math.round(paid*100),feeMinor=Math.round(quote.total*100);
   if(paidMinor<=0||paidMinor>feeMinor)
    throw new HttpError(409,'Student payment ledger exceeds the approved fee total.');
   // Verify the latest installment exists in BOTH the Finance evidence ledger
   // and the immutable student receipt collection, at this same aggregate total.
   const receiptKey=digest('payment:'+String(app.paymentVerification.reference).toLowerCase());
   const [financeEvidence,studentReceipt]=await Promise.all([
    tx.get(db.collection('fundingVerifications').doc(receiptKey)),
    tx.get(db.collection('tuitionReceipts').doc(receiptKey))
   ]);
   if(!financeEvidence.exists||!studentReceipt.exists||
     financeEvidence.data()?.submissionId!==submissionId||
     studentReceipt.data()?.submissionId!==submissionId||
     studentReceipt.data()?.totalPaidMinor!==paidMinor)
    throw new HttpError(409,'Finance must reconcile the latest tuition receipt and payment evidence before a commission payout.');
   const current=commissionPolicyFromSettings(settings);
   const previous=old.data();
   if(old.exists&&(!previous?.policyMode||!Number.isSafeInteger(previous.fullRateMinor)||
     previous.fullRateMinor<=0||previous.recipientUid!==app.agentId||
     previous.feeMinor!==feeMinor))
    throw new HttpError(409,'Existing historical advance requires an administrator reconciliation before additional transfers.');
   const mode=(previous?.policyMode||current.mode) as CommissionMode;
   const fullMinor=old.exists?Number(previous!.fullRateMinor):commissionTotalMinor(feeMinor,current);
   if(fullMinor<=0)throw new HttpError(409,'Configure a positive commission before recording a transfer.');
   const pastMinor=old.exists?Number(previous!.amountMinor):0;
   if(!Number.isSafeInteger(pastMinor)||pastMinor<0||pastMinor>fullMinor)
    throw new HttpError(409,'Previous transfers require financial reconciliation.');
   maxAllowed=advanceEntitlementMinor(feeMinor,paidMinor,fullMinor,mode);
   if(maxAllowed<=pastMinor||requestedMinor>maxAllowed-pastMinor)
    throw new HttpError(409,'Transfer exceeds available commission under the selected payout schedule.');
   // A genuine registered active student or agent may receive the commission.
   const referrer=await tx.get(db.collection('profiles').doc(String(app.agentId)));
   if(!referrer.exists||referrer.data()?.active!==true||
     !['agent','student'].includes(String(referrer.data()?.role)))
    throw new HttpError(409,'Referrer must be a verified, active student or agent.');
   newTotal=pastMinor+requestedMinor;
   const policySnapshot=old.exists?{
     policyMode:mode,rateType:previous!.rateType,rateValue:previous!.rateValue,
     fullRateMinor:fullMinor,feeMinor
   }:{
     policyMode:mode,rateType:current.rateType,
     rateValue:current.rateType==='percentage'?current.percentageBps:current.fixedMinor,
     fullRateMinor:fullMinor,feeMinor
   };
   tx.set(advanceRef,{submissionId,recipientUid:app.agentId,
    ...policySnapshot,amountMinor:newTotal,studentPaidMinor:paidMinor,
    originalTransferAt:previous?.originalTransferAt||now,updatedAt:now,
    transferCount:Number(previous?.transferCount||0)+1,
    transactionId,reason,recordedBy:actor.uid,status:'recorded'}, {merge:true});
   tx.create(proofRef,{submissionId,agentId:app.agentId,kind:'commission_progressive_transfer',
     amountMinor:requestedMinor,recordedBy:actor.uid,recordedAt:now});
   tx.create(receiptRef,{submissionId,reference:String(app.reference||submissionId),
     recipientUid:app.agentId,amountMinor:requestedMinor,currency:'ZMW',
     transactionId,trigger:'advance',recordedBy:actor.uid,recordedAt:now,
     status:'awaiting_confirmation',confirmedAt:null,disputedAt:null,
     createdAt:now,updatedAt:now,payoutType:mode,
     originalCommissionRateMinor:fullMinor,cumulativePaidMinor:newTotal});
   tx.create(db.collection('auditLogs').doc(),{actor:actor.uid,
     action:'commission.progressive_transfer_recorded',target:submissionId,
     details:{amountMinor:requestedMinor,cumulativePaidMinor:newTotal,
       eligibleCumulativeMinor:maxAllowed,policyMode:mode,
       rateType:policySnapshot.rateType,reason},at:now});
   tx.create(db.collection('notificationOutbox').doc(),{
     kind:'commission_payout_receipt',event:'commission_advance_recorded',
     recipient:'agent',recipientUid:app.agentId,
     reference:String(app.reference||submissionId),submissionId,
     title:'Confirm your KASA commission transfer',
     message:'A verified commission transfer was recorded. Confirm the received amount and transaction ID, or dispute the receipt.',
     state:'pending',createdAt:now});
  });
  return json({ok:true,receiptId,amountMinor:requestedMinor,totalPaidMinor:newTotal,
   limitMinor:maxAllowed,message:'Transfer recorded, receipt issued and recipient notified. No funds were transferred by this website.'},201);
 }catch(e){return fail(e);}
}
export async function GET(req:Request){
 try{
  await operator(req,['super_admin','admin']);
  const policyDoc=await db.collection('settings').doc('operations').get();
  const policy=commissionPolicyFromSettings(policyDoc.data()||{});
  const rows:Array<{submissionId:string;reference:string;student:string;recipientUid:string;
   paidMinor:number;feeMinor:number;limitMinor:number;advanceMinor:number;
   advanceTransactionId:string|null;fundingStatus:string;mode:CommissionMode}>=[]; 
  let cursor:FirebaseFirestore.QueryDocumentSnapshot|undefined,partial=false;
  for(let page=0;page<40;page++){
   let query=db.collection('submissions').where('formKind','==','student').orderBy('__name__').limit(250);
   if(cursor)query=query.startAfter(cursor);
   const docs=await query.get();
   for(const doc of docs.docs){
    const record=doc.data();
    if(!record.agentId||record.agentId===record.applicantUid||record.fundingMethod!=='self_funded'
      ||!['letter_issued','payment_verified'].includes(String(record.status)))continue;
    const quote=readApprovedFeeQuote(record.feeQuote),paid=Number(record.paymentVerification?.amount||0);
    if(!quote||!Number.isFinite(paid)||paid<=0||!record.paymentVerification?.recordedAt)continue;
    const paidMinor=Math.round(paid*100),feeMinor=Math.round(quote.total*100);
    if(paidMinor<=0||paidMinor>feeMinor)continue;
    rows.push({submissionId:doc.id,reference:String(record.reference||doc.id),
      student:String(record.answers?.['full-name']||record.answers?.fullNames||'Student'),
      recipientUid:String(record.agentId),paidMinor,feeMinor,
      limitMinor:advanceEntitlementMinor(feeMinor,paidMinor,commissionTotalMinor(feeMinor,policy),policy.mode),
      advanceMinor:0,advanceTransactionId:null,fundingStatus:String(record.status),mode:policy.mode});
   }
   if(docs.size<250)break;
   cursor=docs.docs[docs.docs.length-1];if(page===39)partial=true;
  }
  for(let i=0;i<rows.length;i+=100){
   const refs=rows.slice(i,i+100).map(row=>db.collection('commissionAdvances').doc(row.submissionId));
   const results=await db.getAll(...refs);
   results.forEach((d,j)=>{
    if(d.exists){
     const row=rows[i+j],old=d.data()!;
     row.advanceMinor=Number(old.amountMinor||0);
     row.advanceTransactionId=String(old.transactionId||'');
     if(old.policyMode&&Number.isSafeInteger(old.fullRateMinor)&&old.feeMinor===row.feeMinor){
       row.mode=old.policyMode;
       row.limitMinor=advanceEntitlementMinor(row.feeMinor,row.paidMinor,old.fullRateMinor,old.policyMode);
     }else row.limitMinor=row.advanceMinor; // Historical records need reconciliation.
    }
   });
  }
  return json({rows,commissionRateMinor:policy.fixedMinor,
    commissionPercent:policy.percentageBps/100,mode:policy.mode,rateType:policy.rateType,partial,
    note:'Only independently verified real transfers are recorded. Outstanding cap = available cumulative earned commission minus previous transfers.'});
 }catch(e){return fail(e);}
}
