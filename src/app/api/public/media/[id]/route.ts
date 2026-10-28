import {db} from '@/lib/firebase-admin';
import {HttpError,fail} from '@/lib/errors';
import {R2_PUBLIC_MEDIA,institutionalReadUrl} from '@/lib/institutional-storage';
export const runtime='nodejs';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new HttpError(404,'Image not found.');
  const record=(await db.collection('publicMedia').doc(id).get()).data();
  if(!record||record.status!=='active'||!R2_PUBLIC_MEDIA.test(record.key)||
     !['image/png','image/jpeg'].includes(record.contentType)||
     !Number.isSafeInteger(record.byteSize)||record.byteSize<1||record.byteSize>4*1024*1024)
   throw new HttpError(404,'Image not found.');
  let response:Response;
  try{
   response=await fetch(institutionalReadUrl(record.key),{
    redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-store'
   });
  }catch{throw new HttpError(502,'Image storage is unavailable.');}
  if(!response.ok)throw new HttpError(502,'Image storage is unavailable.');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.byteLength!==record.byteSize)throw new HttpError(502,'Image storage is incomplete.');
  return new Response(bytes,{headers:{
   'Content-Type':record.contentType,'X-Content-Type-Options':'nosniff',
   'Cache-Control':'public, max-age=60, s-maxage=300'
  }});
 }catch(e){return fail(e);}
}
