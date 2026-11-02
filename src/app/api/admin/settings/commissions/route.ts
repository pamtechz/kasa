import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,sameOrigin} from '@/lib/security';
import {commissionPolicyFromSettings} from '@/lib/commission-payment-policy';
export const runtime='nodejs';

/** The policy applies prospectively: payout snapshots preserve prior rates. */
export async function GET(req:Request){
 try{
  await operator(req,['super_admin','admin','reviewer']);
  const doc=await db.collection('settings').doc('operations').get();
  const data=doc.data()||{};
  return json({settings:{
   commissionAmountPaid:Number(data.commissionAmountPaid??0),
   commissionAmountCdf:Number(data.commissionAmountCdf??0),
   referralsEnabled:data.referralsEnabled!==false,
   commissionPaymentMode:commissionPolicyFromSettings(data).mode,
   commissionRateType:commissionPolicyFromSettings(data).rateType,
   commissionPercentage:Number(data.commissionPercentBps||0)/100,
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
  const allowedModes=['progressive','full_on_first_payment','after_full_enrollment'];
  if(!allowedModes.includes(body.commissionPaymentMode))
   throw new HttpError(400,'Choose when a referrer may be paid.');
  if(!['fixed','percentage'].includes(body.commissionRateType))
   throw new HttpError(400,'Choose a fixed-amount or percentage commission.');
  const percentage=Number(body.commissionPercentage);
  if(typeof body.commissionPercentage!=='number'||!Number.isFinite(percentage)||
    percentage<0||percentage>100||Math.abs(percentage*100-Math.round(percentage*100))>0.000001)
   throw new HttpError(400,'Enter a commission percentage from 0 to 100 with at most two decimal places.');
  const percentageBps=Math.round(percentage*100);
  if(body.commissionRateType==='percentage'&&percentageBps===0)
   throw new HttpError(400,'Choose a nonzero percentage to enable this commission policy.');
  const now=new Date().toISOString();
  const ref=db.collection('settings').doc('operations');
  await db.runTransaction(async tx=>{
   const previous=await tx.get(ref),p=previous.data()||{};
   tx.set(ref,{
    commissionAmountPaid:payment,commissionAmountCdf:cdf,
    commissionPaymentMode:body.commissionPaymentMode,
    commissionRateType:body.commissionRateType,
    commissionPercentBps:percentageBps,
    // Legacy fallback remains explicit only for older readers, not as an extra fee.
    commissionAmount:payment,
    referralsEnabled:body.referralsEnabled,
    commissionPolicyUpdatedAt:now,commissionPolicyUpdatedBy:actor.uid,
    updatedAt:now
   },{merge:true});
   tx.create(db.collection('auditLogs').doc(),{
    actor:actor.uid,action:'commission.policy_updated',target:'operations',
    details:{before:{commissionAmountPaid:p.commissionAmountPaid??null,
     commissionAmountCdf:p.commissionAmountCdf??null,referralsEnabled:p.referralsEnabled!==false,
      mode:p.commissionPaymentMode||'after_full_enrollment',type:p.commissionRateType||'fixed',percentBps:p.commissionPercentBps||0},
     after:{commissionAmountPaid:payment,commissionAmountCdf:cdf,referralsEnabled:body.referralsEnabled,
      mode:body.commissionPaymentMode,type:body.commissionRateType,percentBps:percentageBps}},
    at:now
   });
  });
  return json({ok:true,message:'Commission policy saved. Existing payout snapshots and recorded transfers remain unchanged.'});
 }catch(e){return fail(e);}
}
