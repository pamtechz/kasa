import {db} from '@/lib/firebase-admin';
import {operator,sameOrigin,audit,safeText} from '@/lib/security';
import {fail,json,HttpError} from '@/lib/errors';
import {invalidateSubmissionsCache} from '@/lib/server-cache';
export const runtime='nodejs';

export async function GET(req:Request){
 try{
  await operator(req,['super_admin','admin','reviewer']);
  const result=await db.collection('submissions').where('formKind','==','student').limit(500).get();
  const commissions=result.docs.flatMap(doc=>{
   const x=doc.data();
   if(!x.commission||!x.agentId)return [];
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
  const submissionId=safeText(body.submissionId,60);
  const paymentReference=safeText(body.paymentReference,160);
  if(!submissionId)throw new HttpError(400,'Submission ID required.');
  const ref=db.collection('submissions').doc(submissionId);
  const snap=await ref.get();
  if(!snap.exists)throw new HttpError(404,'Application not found.');
  const data=snap.data();
  if(!data?.commission)throw new HttpError(400,'No commission recorded on this application.');

  const now=new Date().toISOString();
  const markPaid = body.paid !== false;
  const updatedCommission = {
   ...data.commission,
   ...(typeof body.amount === 'number' && body.amount > 0 ? {amount: body.amount} : {}),
   paidAt: markPaid ? (data.commission.paidAt || now) : null,
   paymentReference: markPaid ? (paymentReference || data.commission.paymentReference || 'Direct Transfer') : null
  };

  await ref.update({commission: updatedCommission, updatedAt: now});
  invalidateSubmissionsCache();
  await audit(actor.uid,'commission.updated',submissionId,{paid: markPaid, paymentReference});
  return json({ok:true});
 }catch(e){return fail(e);}
}

export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin','admin']);
  const body=await req.json();
  const submissionId=safeText(body.submissionId,60);
  const agentId=safeText(body.agentId,60);
  const amount=Number(body.amount)||300;
  if(!submissionId||!agentId)throw new HttpError(400,'Submission ID and Agent ID required.');
  const ref=db.collection('submissions').doc(submissionId);
  const snap=await ref.get();
  if(!snap.exists)throw new HttpError(404,'Application not found.');
  const now=new Date().toISOString();
  await ref.update({
   agentId,
   commission:{amount,currency:'ZMW',trigger:body.trigger||'manual_adjustment',approvedAt:now},
   updatedAt:now
  });
  invalidateSubmissionsCache();
  await audit(actor.uid,'commission.created',submissionId,{agentId,amount});
  return json({ok:true},201);
 }catch(e){return fail(e);}
}

export async function DELETE(req:Request){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin','admin']);
  const url=new URL(req.url);
  const submissionId=url.searchParams.get('submissionId');
  if(!submissionId)throw new HttpError(400,'Submission ID required.');
  const ref=db.collection('submissions').doc(submissionId);
  const snap=await ref.get();
  if(!snap.exists)throw new HttpError(404,'Application not found.');
  const now=new Date().toISOString();
  await ref.update({
   commission: null,
   updatedAt: now
  });
  invalidateSubmissionsCache();
  await audit(actor.uid,'commission.deleted',submissionId,{});
  return json({ok:true});
 }catch(e){return fail(e);}
}
