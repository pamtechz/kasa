import {db} from '@/lib/firebase-admin';
import {audit,operator,sameOrigin} from '@/lib/security';
import {fail,HttpError,json} from '@/lib/errors';
export const runtime='nodejs';
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);const actor=await operator(req,['super_admin']);
  const {id}=await params;const body=await req.json();
  if(id===actor.uid)throw new HttpError(403,'You cannot edit your own administrator account here.');
  const doc=db.collection('profiles').doc(id),current=await doc.get();
  if(!current.exists||!['admin','reviewer'].includes(current.data()?.role))throw new HttpError(404,'Staff account not found.');
  const changes:Record<string,unknown>={updatedAt:new Date().toISOString()};
  if(body.role!==undefined){
   if(!['admin','reviewer'].includes(body.role))throw new HttpError(400,'Invalid staff role.');
   changes.role=body.role;
  }
  if(typeof body.active==='boolean')changes.active=body.active;
  if(Object.keys(changes).length===1)throw new HttpError(400,'Nothing to change.');
  await doc.update(changes);
  await audit(actor.uid,'staff.updated',id,changes);
  return json({ok:true});
 }catch(e){return fail(e);}
}
