import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {requirePermission,audit,newId,sameOrigin} from '@/lib/security';
import {parseForm} from '@/lib/schema';
export const runtime='nodejs';

let formsCache: {forms: any[]; timestamp: number} | null = null;
const FORMS_CACHE_TTL = 45_000;

export async function GET(req:Request){
 try{await requirePermission(req,'forms.read');
  if(formsCache && Date.now() - formsCache.timestamp < FORMS_CACHE_TTL){
   return json({forms: formsCache.forms});
  }
  const result=await db.collection('forms').limit(100).get();
  const forms=result.docs.map(x=>({...x.data(),id:x.id}));
  formsCache = {forms, timestamp: Date.now()};
  return json({forms});
 }catch(e){return fail(e);}
}
export async function POST(req:Request){
 try{
  sameOrigin(req);const user=await requirePermission(req,'forms.manage');
  const data=parseForm(await req.json());
  const same=await db.collection('forms').where('slug','==',data.slug).limit(1).get();
  if(!same.empty)throw new HttpError(409,'This form URL is already used.');
  const id=newId(),now=new Date().toISOString();
  await db.collection('forms').doc(id).create({...data,version:1,createdAt:now,updatedAt:now});
  formsCache = null;
  await audit(user.uid,'form.created',id,{slug:data.slug});
  return json({id},201);
 }catch(e){return fail(e);}
}
