import {db} from '@/lib/firebase-admin';
import {operator,sameOrigin} from '@/lib/security';
import {HttpError,fail,json} from '@/lib/errors';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  sameOrigin(req);const actor=await operator(req,['super_admin','admin']);
  const {fileId,publish}=await req.json();
  if(typeof fileId!=='string'||!/^[a-f0-9-]{36}$/i.test(fileId)||publish!==true)
   throw new HttpError(400,'Confirm publication of your uploaded banner.');
  const file=(await db.collection('r2Files').doc(fileId).get()).data();
  if(!file||file.ownerUid!==actor.uid||file.status!=='ready'||file.purpose!=='public-media'||file.connectionId==='platform')
   throw new HttpError(403,'Only your completed external banner can be published.');
  await db.collection('publicMedia').doc(fileId).set({fileId,status:'active',createdBy:actor.uid,createdAt:new Date().toISOString()});
  return json({id:fileId,url:'/api/public/media/'+fileId},201);
 }catch(e){return fail(e);}
}
