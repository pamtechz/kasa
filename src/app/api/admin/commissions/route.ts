import {db} from '@/lib/firebase-admin';
import {operator,sameOrigin,safeText} from '@/lib/security';
import {PATCH as updateApplicationStatus} from '@/app/api/admin/submissions/[id]/route';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';

export async function GET(req:Request){
 try{
  await operator(req,['super_admin','admin','reviewer']);
  const result=await db.collection('submissions').where('formKind','==','student').limit(500).get();
  const commissions=result.docs.flatMap(doc=>{
   const x=doc.data();
   if(!x.commission||!x.agentId||!['payment_verified','cdf_approved','commission_paid'].includes(x.status))return [];
   return [{
    submissionId:doc.id,reference:String(x.reference||''),agentId:String(x.agentId),
    trigger:x.commission.trigger||'cdf_approval',amount:Number(x.commission.amount)||0,
    currency:'ZMW',paidAt:x.commission.paidAt||null,paymentReference:x.commission.paymentReference||null,
    fundingEvidence:x.commission.trigger==='payment'?x.paymentVerification?.reference:x.cdfVerification?.reference
   }];
  });
  return json({commissions,totals:{
   eligible:commissions.reduce((n,c)=>n+c.amount,0),
   paid:commissions.filter(c=>Boolean(c.paidAt)).reduce((n,c)=>n+c.amount,0),
   pending:commissions.filter(c=>!c.paidAt).reduce((n,c)=>n+c.amount,0)
  }});
 }catch(e){return fail(e);}
}


export async function PATCH(req:Request){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin','admin']);
  const body=await req.json();
  const submissionId=safeText(body?.submissionId,60);
  const paymentReference=safeText(body?.paymentReference,160);
  if(!submissionId)throw new HttpError(400,'Submission ID is required.');
  if(body?.paid===false)throw new HttpError(403,'Commission payment reversals require a separately audited reconciliation.');
  if(paymentReference.length<5)throw new HttpError(400,'Enter an independently verified payout reference.');
  const record=await db.collection('submissions').doc(submissionId).get();
  if(!record.exists)throw new HttpError(404,'Application not found.');
  const data=record.data()!;
  if(!['payment_verified','cdf_approved'].includes(String(data.status)) ||
     !data.agentId || !data.commission || data.commission.paidAt ||
     !['payment','cdf_approval'].includes(String(data.commission.trigger))){
   throw new HttpError(409,'Commission must be approved and unpaid on a verified enrolled application.');
  }
  if(body?.amount!==undefined && Number(body.amount)!==Number(data.commission.amount)){
   throw new HttpError(400,'Commission amounts are fixed by the approved funding policy.');
  }
  // Reuse the canonical transactional status transition. That transition
  // creates immutable commissionPayments evidence and audits the payout.
  const transitionRequest=new Request(req.url,{
   method:'PATCH',headers:req.headers,
   body:JSON.stringify({status:'commission_paid',paymentReference})
  });
  return updateApplicationStatus(transitionRequest,{params:Promise.resolve({id:submissionId})});
 }catch(e){return fail(e);}
}

export async function POST(req:Request){
 try{
  sameOrigin(req);
  await operator(req,['super_admin','admin']);
  throw new HttpError(403,'Manual commissions cannot be allocated without verified enrollment. Use the application review workflow.');
 }catch(e){return fail(e);}
}

export async function DELETE(req:Request){
 try{
  sameOrigin(req);
  await operator(req,['super_admin','admin']);
  throw new HttpError(403,'Deleting commission evidence is disabled. Request a separately audited reconciliation.');
 }catch(e){return fail(e);}
}
