import {db} from '@/lib/firebase-admin';
import {operator,sameOrigin,safeText} from '@/lib/security';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';

export type CommissionReceipt={
 submissionId:string;reference:string;recipientUid:string;amountMinor:number;currency:'ZMW';
 transactionId:string;status:'awaiting_confirmation'|'confirmed'|'disputed';
 recordedAt:string;recordedBy:string;confirmedAt?:string|null;
 disputedAt?:string|null;confirmedAmountMinor?:number;
 confirmedTransactionId?:string;reportedAmountMinor?:number;reportedTransactionId?:string;
 discrepancyNote?:string;updatedAt:string;
};
const roles=['super_admin','admin','reviewer','finance','agent','student'] as const;
async function viewer(req:Request){return operator(req,[...roles]);}
function staff(role:string){return ['super_admin','admin','reviewer','finance'].includes(role);}

export async function GET(req:Request){
 try{
  const user=await viewer(req);
  const query=new URL(req.url).searchParams;
  const submissionId=safeText(query.get('submissionId'),64);
  if(submissionId){
   const snap=await db.collection('commissionReceipts').doc(submissionId).get();
   if(!snap.exists)throw new HttpError(404,'Payout receipt not found.');
   const receipt=snap.data() as CommissionReceipt;
   if(!staff(user.role)&&receipt.recipientUid!==user.uid)throw new HttpError(403,'Only the payment recipient may view this receipt.');
   return json({receipt:{...receipt,id:snap.id}});
  }
  const q=staff(user.role)
   ?db.collection('commissionReceipts').limit(300)
   :db.collection('commissionReceipts').where('recipientUid','==',user.uid).limit(200);
  const snap=await q.get();
  return json({receipts:snap.docs.map(d=>({id:d.id,...d.data()})),partial:snap.size===(staff(user.role)?300:200)});
 }catch(e){return fail(e);}
}

export async function POST(req:Request){
 try{
  sameOrigin(req);
  const user=await viewer(req);
  if(staff(user.role))throw new HttpError(403,'Recipient acknowledgement must come from the recipient account, not KASA staff.');
  const body=await req.json();
  const submissionId=safeText(body.submissionId,64);
  const transactionId=safeText(body.transactionId,160);
  const action=body.action;
  const amount=body.amountReceived;
  const note=safeText(body.note,600);
  if(!submissionId||!['confirm','dispute'].includes(action))throw new HttpError(400,'Receipt and confirmation decision are required.');
  if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>50000||
    Math.abs(amount*100-Math.round(amount*100))>0.000001)
   throw new HttpError(400,'Enter the amount received in kwacha, to two decimal places.');
  if(action==='confirm'&&transactionId.length<5)throw new HttpError(400,'Enter the transaction ID shown by your payment provider.');
  if(action==='dispute'&&note.length<10)throw new HttpError(400,'Explain the incorrect or missing payment (at least 10 characters).');
  const now=new Date().toISOString(),ref=db.collection('commissionReceipts').doc(submissionId);
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)throw new HttpError(404,'Receipt not found. Ask finance to reconcile older payments.');
   const receipt=snap.data() as CommissionReceipt;
   if(receipt.recipientUid!==user.uid)throw new HttpError(403,'Only the intended recipient can confirm the payout.');
   if(receipt.status!=='awaiting_confirmation')
    throw new HttpError(409,'This receipt already has an acknowledgement. Contact finance if a correction is needed.');
   const actualMinor=Math.round(amount*100);
   const matches=actualMinor===receipt.amountMinor&&
    transactionId.toUpperCase()===receipt.transactionId.trim().toUpperCase();
   if(action==='confirm'&&!matches)
    throw new HttpError(409,'Amount or transaction ID differs from KASA\'s recorded transfer. Choose Report a problem instead.');
   const result=action==='confirm'?'confirmed':'disputed';
   tx.update(ref,{
    status:result,
    ...(result==='confirmed'?{confirmedAt:now,confirmedBy:user.uid,
      confirmedAmountMinor:actualMinor,confirmedTransactionId:transactionId}
     :{disputedAt:now,disputedBy:user.uid,
       reportedAmountMinor:actualMinor,reportedTransactionId:transactionId,discrepancyNote:note}),
    updatedAt:now
   });
   tx.create(db.collection('auditLogs').doc(),{
    actor:user.uid,action:'commission.receipt_'+result,
    target:submissionId,details:{recordedAmountMinor:receipt.amountMinor,
     amountMinor:actualMinor,transactionIdMatched:matches},at:now
   });
   if(result==='disputed'){
    tx.create(db.collection('notificationOutbox').doc(),{
     kind:'commission_receipt_dispute',event:'commission_receipt_disputed',
     recipient:'admin',recipientUid:null,reference:receipt.reference,
     title:'Commission payout discrepancy requires investigation',
     message:'A payment recipient disputes the recorded amount or transaction ID. Review the receipt before closing reconciliation.',
     state:'pending',createdAt:now
    });
   }
  });
  return json({ok:true,status:action==='confirm'?'confirmed':'disputed',message:action==='confirm'?
   'You acknowledged receipt of the stated amount and transaction ID. Your acknowledgement is saved to the official KASA receipt.':
   'Your payment discrepancy was recorded and flagged for administrator review.'});
 }catch(e){return fail(e);}
}
