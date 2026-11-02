import {db} from '@/lib/firebase-admin';
import {commissionDecision} from '@/lib/commission-eligibility';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,newId,sameOrigin,safeText} from '@/lib/security';
export const runtime='nodejs';

const paymentMethods=['mtn','airtel','zamtel','bank'] as const;
type Action='approve'|'reject'|'withdraw';

/** One earned, unpaid commission per request. The authoritative amount comes from the
 * funded student submission, never a client-provided monetary figure.
 * This endpoint never transfers money; payment remains the canonical audited
 * commissions status transition after an independently confirmed transfer. */
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await operator(req,['agent']);
  const body=await req.json();
  const submissionId=safeText(body.submissionId,64);
  const method=paymentMethods.includes(body.paymentMethod)?body.paymentMethod:'mtn';
  const accountName=safeText(body.accountName,100);
  const accountNumber=safeText(body.accountNumber,50);
  if(!submissionId||!accountName||!accountNumber)
   throw new HttpError(400,'Choose a verified unpaid commission and provide account name and number.');
  if(Object.prototype.hasOwnProperty.call(body,'amount'))
   throw new HttpError(400,'Payout amount is determined by the verified commission, not by the requester.');
  const id=newId(),now=new Date().toISOString();
  const ref=db.collection('submissions').doc(submissionId);
  const reservation=db.collection('payoutReservations').doc(submissionId);
  const payout=db.collection('payoutRequests').doc(id);
  await db.runTransaction(async tx=>{
   const [submission,locked]=await Promise.all([tx.get(ref),tx.get(reservation)]);
   const record=submission.data();
   const decision=record?commissionDecision(record):null;
   if(!record||record.agentId!==actor.uid||!decision?.eligible||record.commission?.paidAt)
    throw new HttpError(409,'Only your own verified, eligible and unpaid commissions can be requested.');
   if(locked.exists)throw new HttpError(409,'A payout request already exists for this commission.');
   const amountMinor=Math.round(decision.amount*100);
   if(!Number.isSafeInteger(amountMinor)||amountMinor<=0)
    throw new HttpError(409,'Commission amount requires finance reconciliation.');
   tx.create(reservation,{requestId:id,agentUid:actor.uid,amountMinor,status:'pending',createdAt:now});
   tx.create(payout,{
    id,submissionId,agentUid:actor.uid,agentName:actor.displayName||actor.email,
    agentCode:actor.agentCode||'',amount:decision.amount,currency:'ZMW',
    paymentMethod:method,accountName,accountNumber,
    status:'pending',requestedAt:now,updatedAt:now,
    trigger:decision.trigger
   });
   tx.create(db.collection('notificationOutbox').doc(),{
    kind:'commission_payout_request',event:'payout_requested',
    title:'Commission payout request requires review',
    message:'A verified agent commission payout request has been submitted for finance review.',
    recipient:'admin',recipientUid:null,reference:submissionId,createdAt:now,state:'pending'
   });
  });
  return json({ok:true,payoutId:id,status:'pending',message:'Commission request submitted for administrative review. No funds have been transferred.'},201);
 }catch(e){return fail(e);}
}

export async function GET(req:Request){
 try{
  const actor=await operator(req,['super_admin','admin','agent']);
  const query=actor.role==='agent'
   ?db.collection('payoutRequests').where('agentUid','==',actor.uid).limit(200)
   :db.collection('payoutRequests').limit(300);
  const snap=await query.get();
  return json({payouts:snap.docs.map(d=>({id:d.id,...d.data()}))});
 }catch(e){return fail(e);}
}

export async function PATCH(req:Request){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin','admin','agent']);
  const body=await req.json();
  const id=safeText(body.id,64),action=body.action as Action;
  const reason=safeText(body.reason,300);
  if(!id||!['approve','reject','withdraw'].includes(action))throw new HttpError(400,'Valid request and action are required.');
  if(action==='withdraw'&&actor.role!=='agent')
   throw new HttpError(403,'Only the requesting agent can withdraw a request.');
  if(action!=='withdraw'&&actor.role==='agent')
   throw new HttpError(403,'Only a KASA administrator can approve or reject a payout request.');
  if(action==='reject'&&reason.length<8)
   throw new HttpError(400,'Provide the reason for rejecting this payout request.');
  const ref=db.collection('payoutRequests').doc(id),now=new Date().toISOString();
  await db.runTransaction(async tx=>{
   const doc=await tx.get(ref),request=doc.data();
   if(!request)throw new HttpError(404,'Payout request not found.');
   if(actor.role==='agent'&&request.agentUid!==actor.uid)
    throw new HttpError(403,'You may only withdraw your own payout request.');
   if(request.status!=='pending' && !(request.status==='approved'&&action==='reject'))
    throw new HttpError(409,'The payout request cannot be changed in its current state.');
   const reserve=db.collection('payoutReservations').doc(String(request.submissionId));
   const [locked,submission]=await Promise.all([tx.get(reserve),tx.get(db.collection('submissions').doc(String(request.submissionId)))]);
   if(!locked.exists||locked.data()?.requestId!==id)
    throw new HttpError(409,'Payout reservation needs reconciliation.');
   if(submission.data()?.commission?.paidAt)throw new HttpError(409,'The commission is already paid.');
   if(action==='approve'){
    if(!commissionDecision(submission.data()||{}).eligible)throw new HttpError(409,'Commission is no longer eligible.');
    tx.update(ref,{status:'approved',approvedAt:now,approvedBy:actor.uid,updatedAt:now});
    tx.update(reserve,{status:'approved',updatedAt:now});
   }else{
    tx.update(ref,{status:action==='withdraw'?'withdrawn':'rejected',closedAt:now,closedBy:actor.uid,reason:reason||null,updatedAt:now});
    tx.delete(reserve);
   }
  });
  return json({ok:true,status:action==='approve'?'approved':action==='withdraw'?'withdrawn':'rejected'});
 }catch(e){return fail(e);}
}
