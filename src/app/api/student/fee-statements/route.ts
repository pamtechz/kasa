import {db} from '@/lib/firebase-admin';
import {verifiedStudent} from '@/lib/student-access';
import {financeSnapshot} from '@/lib/finance-operations';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const user=await verifiedStudent(req);
  const id=new URL(req.url).searchParams.get('applicationId')||'';
  if(!/^[a-zA-Z0-9_-]{8,64}$/.test(id))throw new HttpError(400,'Select a valid linked application.');
  const snap=await db.collection('submissions').doc(id).get();
  const app=snap.data();
  if(!snap.exists||app?.applicantUid!==user.uid||app?.formKind!=='student')
   throw new HttpError(404,'Student application not found in your account.');
  const rows=await db.collection('tuitionReceipts').where('submissionId','==',id).limit(101).get();
  const receiptData=rows.docs.slice(0,100).map(doc=>({id:doc.id,
   amountMinor:doc.data().amountMinor as number,
   totalPaidMinor:doc.data().totalPaidMinor as number,
   transactionId:String(doc.data().transactionId||''),
   paymentMethod:String(doc.data().paymentMethod||''),
   recordedAt:String(doc.data().recordedAt||'')
  })).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt));
  const summary=financeSnapshot(app,rows.size<=100?receiptData:undefined);
  const receiptMismatch=summary.flags.some(x=>x.id==='legacy_receipt_gap');
  return json({application:{id,reference:String(app.reference||''),
   programme:String(app.answers?.['programme-pathway']||app.formTitle||'KASA programme'),
   fundingMethod:String(app.fundingMethod||'self_funded'),status:String(app.status||'submitted')},
   summary:{quotedFeeMinor:summary.feeMinor,recordedTuitionMinor:summary.paidMinor,
    cdfReceivedMinor:summary.cdfReceivedMinor,balanceMinor:summary.balanceMinor,
    enrolledAndFunded:summary.fullyEnrolled,receiptTotalMinor:summary.receiptSumMinor,
    needsReconciliation:receiptMismatch||summary.paidMinor===null,
    quoteUnavailable:summary.feeMinor===null},
   receipts:receiptData,partial:rows.size>100});
 }catch(e){return fail(e);}
}
