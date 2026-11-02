import {db} from '@/lib/firebase-admin';
import {commissionDecision} from '@/lib/commission-eligibility';
import {requireCapability,sameOrigin,safeText} from '@/lib/security';
import {PATCH as updateApplicationStatus} from '@/app/api/admin/submissions/[id]/route';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';

export async function GET(req:Request){
 try{
  await requireCapability(req,'commissions.read');
  const docs:FirebaseFirestore.QueryDocumentSnapshot[]=[];
  let cursor:FirebaseFirestore.QueryDocumentSnapshot|undefined;
  let truncated=false;
  for(let page=0;page<40;page++){
   let query=db.collection('submissions').where('formKind','==','student').orderBy('__name__').limit(250);
   if(cursor)query=query.startAfter(cursor);
   const pageDocs=await query.get();docs.push(...pageDocs.docs);
   if(pageDocs.size<250)break;
   cursor=pageDocs.docs[pageDocs.docs.length-1];
   if(page===39)truncated=true;
  }
  const advanceSnapshot=await db.collection('commissionAdvances').limit(501).get();
  const advancePartial=advanceSnapshot.size>500;
  const advances=new Map(advanceSnapshot.docs.slice(0,500).map(d=>
   [d.id,{amountMinor:Number(d.data().amountMinor||0),recipientUid:String(d.data().recipientUid||''),
     policyMode:String(d.data().policyMode||'historical'),fullRateMinor:Number(d.data().fullRateMinor||0)}]));
  const commissions=docs.flatMap(doc=>{
   const x=doc.data();
   const decision=commissionDecision(x);
   if(!decision.eligible)return [];
   return [{
    submissionId:doc.id,reference:String(x.reference||''),agentId:String(x.agentId),
    trigger:decision.trigger,amount:decision.amount,
    advancePaid:Math.max(0,Number(advances.get(doc.id)?.amountMinor||0)/100),
    currency:'ZMW',paidAt:x.commission.paidAt||null,paymentReference:x.commission.paymentReference||null,
    fundingEvidence:decision.trigger==='payment'?x.paymentVerification?.reference:x.cdfDisbursement?.bankReference
   }];
  });
  const reconciliation=docs.flatMap(doc=>{
   const x=doc.data();
   if(!x.commission||!x.agentId||commissionDecision(x).eligible)return [];
   const decision=commissionDecision(x);
   return [{submissionId:doc.id,reference:String(x.reference||''),agentId:String(x.agentId),
     recordedAmount:Number(x.commission.amount)||0,previouslyPaid:Boolean(x.commission.paidAt),
     legacyTrigger:String(x.commission.trigger||''),reason:decision.reason}];
  });
  const progressive=[...advances.entries()].map(([submissionId,proof])=>{
    const doc=docs.find(x=>x.id===submissionId);
    const record=doc?.data();
    return {submissionId,reference:String(record?.reference||submissionId),
      agentId:proof.recipientUid,amount:proof.amountMinor/100,
      policyMode:proof.policyMode,fullyVerified:record?commissionDecision(record).eligible:false};
  }).filter(x=>!x.fullyVerified);
  const paidAdvances=[...advances.values()].reduce((n,a)=>n+Math.max(0,a.amountMinor)/100,0);
  const paidFinal=commissions.filter(c=>Boolean(c.paidAt))
    .reduce((n,c)=>n+Math.max(0,c.amount-c.advancePaid),0);
  return json({commissions,reconciliation,progressive,
   truncated:truncated||advancePartial,totals:{
   eligible:commissions.reduce((n,c)=>n+c.amount,0),
   paid:paidFinal+paidAdvances,
   pending:commissions.filter(c=>!c.paidAt).reduce((n,c)=>n+Math.max(0,c.amount-c.advancePaid),0)
  }});
 }catch(e){return fail(e);}
}


export async function PATCH(req:Request){
 try{
  sameOrigin(req);
  await requireCapability(req,'commissions.manage');
  const body=await req.json();
  const submissionId=safeText(body?.submissionId,60);
  const paymentReference=safeText(body?.paymentReference,160);
  if(!submissionId)throw new HttpError(400,'Submission ID is required.');
  if(body?.paid===false)throw new HttpError(403,'Commission payment reversals require a separately audited reconciliation.');
  if(paymentReference.length<5)throw new HttpError(400,'Enter an independently verified payout reference.');
  const record=await db.collection('submissions').doc(submissionId).get();
  if(!record.exists)throw new HttpError(404,'Application not found.');
  const data=record.data()!;
  if(!commissionDecision(data).eligible || !data.commission || data.commission.paidAt || !['payment_verified','cdf_funds_received'].includes(String(data.status))){
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
  await requireCapability(req,'commissions.manage');
  throw new HttpError(403,'Manual commissions cannot be allocated without verified enrollment. Use the application review workflow.');
 }catch(e){return fail(e);}
}

export async function DELETE(req:Request){
 try{
  sameOrigin(req);
  await requireCapability(req,'commissions.manage');
  throw new HttpError(403,'Deleting commission evidence is disabled. Request a separately audited reconciliation.');
 }catch(e){return fail(e);}
}
