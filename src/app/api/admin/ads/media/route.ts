import type {NextRequest} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {HttpError,fail,json} from '@/lib/errors';
import {operator,sameOrigin,rateLimit,newId} from '@/lib/security';
import {platformR2} from '@/lib/r2-storage';
import {uploadInstitutionalObject} from '@/lib/institutional-storage';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin','admin']);
  await rateLimit(req,'ad-media',12,10);
  if(!platformR2())throw new HttpError(503,'KASA institutional R2 storage is not yet configured.');
  if(Number(req.headers.get('content-length')||0)>4.5*1024*1024)
   throw new HttpError(413,'Maximum banner size is 4 MB.');
  const form=await req.formData(),file=form.get('file');
  if(!(file instanceof File)||file.size<1||file.size>4*1024*1024||
     !['image/png','image/jpeg'].includes(file.type))
   throw new HttpError(400,'Upload a JPG or PNG image no larger than 4 MB.');
  const bytes=Buffer.from(await file.arrayBuffer());
  const isPng=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isJpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!(file.type==='image/png'&&isPng||file.type==='image/jpeg'&&isJpg))
   throw new HttpError(400,'Banner image content does not match the declared type.');
  const id=newId(),key='r2-public-media/'+id+(isPng?'.png':'.jpg');
  await uploadInstitutionalObject(key,bytes,file.type);
  await db.collection('publicMedia').doc(id).create({
   key,contentType:file.type,byteSize:file.size,status:'active',
   createdBy:actor.uid,createdAt:new Date().toISOString()
  });
  return json({id,url:'/api/public/media/'+id},201);
 }catch(e){return fail(e);}
}
