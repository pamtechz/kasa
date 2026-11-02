import {db} from '@/lib/firebase-admin';
import {safeText} from '@/lib/security';
import {getTuitionReceiptViewer} from '@/lib/tuition-receipt-server';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';

export async function GET(req:Request){
 try{
  const viewer=await getTuitionReceiptViewer(req);
  const submissionId=safeText(new URL(req.url).searchParams.get('submissionId'),64);
  if(!/^[A-Za-z0-9_-]{8,64}$/.test(submissionId))
   throw new HttpError(400,'Choose a valid student application.');
  if(!viewer.staff){
   const app=await db.collection('submissions').doc(submissionId).get();
   if(!app.exists||app.data()?.applicantUid!==viewer.uid)
    throw new HttpError(404,'Application not found for your student account.');
  }
  const receipts=await db.collection('tuitionReceipts').where('submissionId','==',submissionId).limit(100).get();
  return json({receipts:receipts.docs.map(doc=>({id:doc.id,
   applicationReference:doc.data().applicationReference,
   amountMinor:doc.data().amountMinor,totalPaidMinor:doc.data().totalPaidMinor,
   feeTotalMinor:doc.data().feeTotalMinor,currency:'ZMW',
   paymentMethod:doc.data().paymentMethod,transactionId:doc.data().transactionId,
   recordedAt:doc.data().recordedAt,status:doc.data().status
  })).sort((a,b)=>String(b.recordedAt).localeCompare(String(a.recordedAt))),
  partial:receipts.size===100});
 }catch(e){return fail(e);}
}
