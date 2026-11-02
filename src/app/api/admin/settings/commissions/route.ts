import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,sameOrigin,audit} from '@/lib/security';
export const runtime='nodejs';

/** One visible policy: no commissions until actual full funding and enrollment.
 * The stored rates affect only future funding decisions; existing commission
 * snapshots are never recalculated when the administrator changes a rate. */
export async function GET(req:Request){
 try{
  await operator(req,['super_admin','admin','reviewer']);
  const doc=await db.collection('settings').doc('operations').get();
  const data=doc.data()||{};
  return json({settings:{
   commissionAmountPaid:Number(data.commissionAmountPaid??0),
   commissionAmountCdf:Number(data.commissionAmountCdf??0),
   referralsEnabled:data.referralsEnabled!==false,
   updatedAt:data.commissionPolicyUpdatedAt||data.updatedAt||null,
   updatedBy:data.commissionPolicyUpdatedBy||null
  }});
 }catch(e){return fail(e);}
}

export async function PATCH(req:Request){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin','admin']);
  const body=await req.json();
  const parse=(value:unknown,label:string)=>{
   if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>50000||
     Math.abs(value*100-Math.round(value*100))>.000001)
    throw new HttpError(400,label+' must be a valid ZMW amount from K0 to K50,000, with at most two decimal places.');
   return Math.round(value*100)/100;
  };
  const payment=parse(body.commissionAmountPaid,'Self-funded commission');
  const cdf=parse(body.commissionAmountCdf,'CDF-funded commission');
  if(typeof body.referralsEnabled!=='boolean')throw new HttpError(400,'Choose whether new referrals are enabled.');
  const now=new Date().toISOString();
  const ref=db.collection('settings').doc('operations');
  await db.runTransaction(async tx=>{
   const previous=await tx.get(ref),p=previous.data()||{};
   tx.set(ref,{
    commissionAmountPaid:payment,commissionAmountCdf:cdf,
    // Legacy fallback remains explicit only for older readers, not as an extra fee.
    commissionAmount:payment,
    referralsEnabled:body.referralsEnabled,
    commissionPolicyUpdatedAt:now,commissionPolicyUpdatedBy:actor.uid,
    updatedAt:now
   },{merge:true});
   tx.create(db.collection('auditLogs').doc(),{
    actor:actor.uid,action:'commission.policy_updated',target:'operations',
    details:{before:{commissionAmountPaid:p.commissionAmountPaid??null,
     commissionAmountCdf:p.commissionAmountCdf??null,referralsEnabled:p.referralsEnabled!==false},
     after:{commissionAmountPaid:payment,commissionAmountCdf:cdf,referralsEnabled:body.referralsEnabled}},
    at:now
   });
  });
  return json({ok:true,message:'Future referral commission rates updated. Existing verified commissions are unchanged.'});
 }catch(e){return fail(e);}
}
