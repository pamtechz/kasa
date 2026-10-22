import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {requirePermission,audit,sameOrigin} from '@/lib/security';
import {parseForm} from '@/lib/schema';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{await requirePermission(req,'forms.read');const {id}=await params;
  const snap=await db.collection('forms').doc(id).get();if(!snap.exists)throw new HttpError(404,'Form not found.');
  return json({form:{id,...snap.data()}});
 }catch(e){return fail(e);}
}
export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);const user=await requirePermission(req,'forms.manage');const {id}=await params;
  const data=parseForm(await req.json());
  const all=await db.collection('forms').where('slug','==',data.slug).limit(2).get();
  if(all.docs.some(x=>x.id!==id))throw new HttpError(409,'Form URL is already used.');
  let version=0;
  await db.runTransaction(async tx=>{
   const doc=db.collection('forms').doc(id);const snap=await tx.get(doc);
   if(!snap.exists)throw new HttpError(404,'Form not found.');
   version=Number(snap.data()?.version||0)+1;
   tx.update(doc,{...data,version,updatedAt:new Date().toISOString()});
  });
  await audit(user.uid,'form.updated',id,{version});return json({id,version});
  }catch(e){return fail(e);}
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);
  const user=await requirePermission(req,'forms.manage');
  const {id}=await params;
  const doc=db.collection('forms').doc(id);
  const snap=await doc.get();
  if(!snap.exists)throw new HttpError(404,'Form not found.');
  await doc.delete();
  await audit(user.uid,'form.deleted',id,{slug:snap.data()?.slug});
  return json({ok:true});
 }catch(e){return fail(e);}
}
