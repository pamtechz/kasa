import 'server-only';
import {db} from '@/lib/firebase-admin';
import {verifiedStudent} from '@/lib/student-access';
import {operator} from '@/lib/security';
import {HttpError} from '@/lib/errors';

export type TuitionReceiptData={
 submissionId:string;applicationReference:string;applicantUid:string|null;
 amountMinor:number;totalPaidMinor:number;feeTotalMinor:number;currency:'ZMW';
 paymentMethod:string;transactionId:string;recordedAt:string;recordedBy:string;
 fundingStatus:string;status:string;note?:string;
};
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
 const record=doc.data() as TuitionReceiptData;
 if(!viewer.staff){
  const application=await db.collection('submissions').doc(String(record.submissionId)).get();
  if(!application.exists||application.data()?.applicantUid!==viewer.uid)
   throw new HttpError(404,'Receipt not found for your linked student account.');
 }
 return {id:doc.id,...record};
}

