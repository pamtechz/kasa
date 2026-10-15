import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import {loadIntake} from '@/lib/intake-server';
import {intakeWindow} from '@/lib/intake-policy';
import type {FormKind} from '@/lib/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Listing={slug:string;title:string;subtitle:string;kind:FormKind;version:number;open:boolean;reason:string};
/** Only published metadata; never expose draft schemas or applicant records. */
export async function GET(){
 try{
  const [result,intake]=await Promise.all([db.collection('forms').where('published','==',true).limit(100).get(),loadIntake()]);
  const forms:Listing[]=result.docs.map(doc=>{
   const f=doc.data();
   const state=intakeWindow(intake,String(f.slug||''));
   return {slug:String(f.slug||''),title:String(f.title||''),subtitle:String(f.subtitle||''),kind:f.kind as FormKind,version:Number(f.version||1),...state};
  }).filter(f=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug)).sort((a,b)=>a.title.localeCompare(b.title));
  return json({forms});
 }catch(error){return fail(error);}
}
