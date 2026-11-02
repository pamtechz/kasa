import {db} from '@/lib/firebase-admin';
import {verifiedStudent} from '@/lib/student-access';
import {financeSnapshot} from '@/lib/finance-operations';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';

/** The student can inspect only an application already linked to their verified identity.
 * No speculative financial totals for missing/invalid historical quotes. */
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await verifiedStudent(req),{id}=await params;
  if(!/^[A-Za-z0-9_-]{8,64}$/.test(id))throw new HttpError(400,'Invalid application.');
  const doc=await db.collection('submissions').doc(id).get();
  if(!doc.exists||doc.data()?.applicantUid!==user.uid)
   throw new HttpError(404,'Linked student application not found.');
  const record=doc.data()!;
  const snap=await db.collection('tuitionReceipts').where('submissionId','==',id).limit(201).get();
  const partial=snap.size>200;
  const receipts=snap.docs.slice(0,200).map(d=>({
   id:d.id,recordedAt:String(d.data().recordedAt||''),
   amountMinor:Number(d.data().amountMinor),totalPaidMinor:Number(d.data().totalPaidMinor),
   transactionId:String(d.data().transactionId||''),paymentMethod:String(d.data().paymentMethod||'')
  })).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)||a.id.localeCompare(b.id));
  // Missing historical installment evidence is not silently represented as complete.
  const snapshot=financeSnapshot(record,partial?undefined:receipts);
  return json({
   application:{id,reference:String(record.reference||id),
    programme:String(record.answers?.['programme-pathway']||record.formTitle||'Programme'),
    status:String(record.status||'submitted'),fundingMethod:String(record.fundingMethod||'self_funded')},
   statement:{
    feeMinor:snapshot.feeMinor,paidMinor:snapshot.paidMinor,cdfReceivedMinor:snapshot.cdfReceivedMinor,
    balanceMinor:snapshot.balanceMinor,fullyEnrolled:snapshot.fullyEnrolled,
    receiptSumMinor:partial?null:snapshot.receiptSumMinor,
    receiptHistoryPartial:partial,flags:snapshot.flags,
    receipts
   }
  });
 }catch(e){return fail(e);}
}
