import {fail,json,HttpError} from '@/lib/errors';
import {operator,sameOrigin} from '@/lib/security';
import {setInitialPassword,validateInitialPassword} from '@/lib/admin-initial-password';
export const runtime='nodejs';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin']);
  const {id}=await params;
  const body=await req.json().catch(()=>({}));
  if(body.confirm!==true)throw new HttpError(400,'Explicit confirmation is required.');
  validateInitialPassword(body.password);
  return json({ok:true,...await setInitialPassword(id,actor.uid,body.password)});
 }catch(e){return fail(e);}
}
