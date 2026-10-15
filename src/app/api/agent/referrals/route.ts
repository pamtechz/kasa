import {db} from '@/lib/firebase-admin';
import {operator} from '@/lib/security';
import {fail,json} from '@/lib/errors';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const agent=await operator(req,['agent']);
  const [records,forms]=await Promise.all([
   db.collection('submissions').where('agentId','==',agent.uid).limit(300).get(),
   db.collection('forms').where('published','==',true).limit(100).get()
  ]);
  return json({
   agent:{agentCode:agent.agentCode,district:agent.district,active:agent.active},
   forms:forms.docs.filter(d=>d.data().kind==='student').map(d=>({slug:String(d.data().slug),title:String(d.data().title)})),
   referrals:records.docs.map(d=>{
    const x=d.data();return {
     id:d.id,reference:x.reference,submittedAt:x.submittedAt,status:x.status,
     commission:x.commission?{amount:Number(x.commission.amount),currency:'ZMW',trigger:x.commission.trigger||'cdf_approval',paidAt:x.commission.paidAt||null}:null
    };
   })
  });
 }catch(e){return fail(e);}
}
