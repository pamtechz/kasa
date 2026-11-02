import {db} from '@/lib/firebase-admin';
import {verifiedStudent} from '@/lib/student-access';
import {operator,safeText} from '@/lib/security';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';

export async function getTuitionReceiptViewer(req:Request):Promise<{uid:string;staff:boolean}>{
 try{
  const actor=await verifiedStudent(req);
  return {uid:actor.uid,staff:false};
 }catch{
  const actor=await operator(req,['super_admin','admin','reviewer','finance']);
  return {uid:actor.uid,staff:true};
 }
}
export async function readTuitionReceipt(req:Request,receiptId:string){
 const viewer=await getTuitionReceiptViewer(req);
 const doc=await db.collection('tuitionReceipts').doc(receiptId).get();
 if(!doc.exists)throw new HttpError(404,'Tuition receipt not found.');
 const record=doc.data()!;
 if(!viewer.staff){
  const application=await db.collection('submissions').doc(String(record.submissionId)).get();
  if(!application.exists||application.data()?.applicantUid!==viewer.uid)
   throw new HttpError(404,'Receipt not found for your linked student account.');
 }
 return {id:doc.id,...record};
}

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
