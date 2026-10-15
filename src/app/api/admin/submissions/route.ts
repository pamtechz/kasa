import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import {operator} from '@/lib/security';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const user=await operator(req,['super_admin','admin','reviewer','agent']);
  const q=user.role==='agent'?db.collection('submissions').where('agentId','==',user.uid):db.collection('submissions');
  const result=await q.limit(300).get();
  const items=result.docs.map(x=>({id:x.id,...x.data(),...(user.role==='agent'?{answers:{},formSnapshot:undefined,history:undefined}: {})})).sort((a,b)=>String(b.submittedAt).localeCompare(String(a.submittedAt)));
  return json({submissions:items});
 }catch(e){return fail(e);}
}
