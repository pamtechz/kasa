import {db} from '@/lib/firebase-admin';
import {signedR2Read} from '@/lib/r2-storage';
import {HttpError,fail} from '@/lib/errors';
import {R2_PUBLIC_MEDIA,institutionalReadUrl} from '@/lib/institutional-storage';
export const runtime='nodejs';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new HttpError(404,'Image not found.');
  const record=(await db.collection('publicMedia').doc(id).get()).data();
  if(!record||record.status!=='active')throw new HttpError(404,'Image not found.');
  if(record.fileId===id){
   const file=(await db.collection('r2Files').doc(id).get()).data();
   if(!file||file.status!=='ready'||file.purpose!=='public-media'||file.ownerUid!==record.createdBy)
    throw new HttpError(404,'Image not found.');
   return new Response(null,{status:307,headers:{Location:await signedR2Read(file.ownerUid,file.connectionId,file.key),'Cache-Control':'no-store'}});
  }
  if(!R2_PUBLIC_MEDIA.test(record.key))throw new HttpError(404,'Image not found.');
  return new Response(null,{status:307,headers:{Location:institutionalReadUrl(record.key),'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}
}
