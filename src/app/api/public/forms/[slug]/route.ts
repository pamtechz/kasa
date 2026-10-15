import {db} from '@/lib/firebase-admin';
import {fail,HttpError,json} from '@/lib/errors';
import type {FormSchema} from '@/lib/types';
export const runtime='nodejs';
export async function GET(_:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const {slug}=await params;
  const result=await db.collection('forms').where('slug','==',slug).limit(1).get();
  const form=result.docs[0];
  if(!form||!form.data().published)throw new HttpError(404,'This application form is not currently accepting submissions.');
  return json({form:{...form.data(),id:form.id} as FormSchema});
 }catch(e){return fail(e);}
}
