import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {requirePermission,audit,newId,sameOrigin} from '@/lib/security';
import {parseForm} from '@/lib/schema';
export const runtime='nodejs';
export async function POST(req:Request){try{
 sameOrigin(req);const user=await requirePermission(req,'forms.manage');
 const text=await req.text();if(text.length>150000)throw new HttpError(413,'Template exceeds 150 KB.');
 let raw:unknown;try{raw=JSON.parse(text);}catch{throw new HttpError(400,'Invalid JSON template.');}
 const data=parseForm(raw);
 const found=await db.collection('forms').where('slug','==',data.slug).limit(1).get();
 if(!found.empty)throw new HttpError(409,'A form with this slug already exists. Change it before importing.');
 const id=newId(),now=new Date().toISOString();
 await db.collection('forms').doc(id).create({...data,published:false,version:1,createdAt:now,updatedAt:now});
 await audit(user.uid,'form.imported',id,{slug:data.slug});
 return json({id},201);
}catch(e){return fail(e);}}
