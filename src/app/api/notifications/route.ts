import {db} from '@/lib/firebase-admin';
import {operator} from '@/lib/security';
import {fail,json} from '@/lib/errors';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const user=await operator(req,['super_admin','admin','reviewer','agent']);
  const items=await db.collection('notificationOutbox').limit(300).get();
  const notifications=items.docs.map(d=>({id:d.id,...d.data()})).filter((x:any)=>{
   if(user.role==='agent')return x.recipient==='agent'&&x.recipientUid===user.uid;
   if(user.role==='reviewer')return x.recipient==='reviewer';
   return x.recipient==='admin'||x.recipient==='reviewer';
  }).sort((a:any,b:any)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,100);
  return json({notifications});
 }catch(e){return fail(e);}
}
