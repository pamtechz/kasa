import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,audit,newId,sameOrigin} from '@/lib/security';
import {parseForm} from '@/lib/schema';
export const runtime='nodejs';
export async function GET(req:Request){
 try{await operator(req,['super_admin','admin','reviewer']);
  const result=await db.collection('forms').limit(100).get();
  return json({forms:result.docs.map(x=>({...x.data(),id:x.id}))});
 }catch(e){return fail(e);}
}
export async function POST(req:Request){
 try{
  sameOrigin(req);const user=await operator(req,['super_admin','admin']);
  const data=parseForm(await req.json());
  const same=await db.collection('forms').where('slug','==',data.slug).limit(1).get();
  if(!same.empty)throw new HttpError(409,'This form URL is already used.');
  const id=newId(),now=new Date().toISOString();
  await db.collection('forms').doc(id).create({...data,version:1,createdAt:now,updatedAt:now});
  await audit(user.uid,'form.created',id,{slug:data.slug});
  return json({id},201);
 }catch(e){return fail(e);}
}
