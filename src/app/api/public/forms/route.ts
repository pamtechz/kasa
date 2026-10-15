import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import type {FormKind} from '@/lib/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Listing={slug:string;title:string;subtitle:string;kind:FormKind;version:number};
/** Only published metadata; never expose draft schemas or applicant records. */
export async function GET(){
 try{
  const result=await db.collection('forms').where('published','==',true).limit(100).get();
  const forms:Listing[]=result.docs.map(doc=>{
   const f=doc.data();
   return {slug:String(f.slug||''),title:String(f.title||''),subtitle:String(f.subtitle||''),kind:f.kind as FormKind,version:Number(f.version||1)};
  }).filter(f=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug)).sort((a,b)=>a.title.localeCompare(b.title));
  return json({forms});
 }catch(error){return fail(error);}
}
