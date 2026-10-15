import {db} from '@/lib/firebase-admin';
import {operator} from '@/lib/security';
import {fail,json} from '@/lib/errors';
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
