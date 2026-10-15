import type {NextRequest} from 'next/server';
import {storage} from '@/lib/firebase-admin';
import {fail,HttpError,json} from '@/lib/errors';
import {newId,rateLimit,requireAppCheck,sameOrigin} from '@/lib/security';
export const runtime='nodejs';
const allowed:Record<string,string>={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'};
export async function POST(req:NextRequest){
 try{
  sameOrigin(req);
  await requireAppCheck(req);
  await rateLimit(req,'upload',12,10);
  if(Number(req.headers.get('content-length')||0)>4.5*1024*1024)throw new HttpError(413,'Maximum upload is 4 MB.');
  const data=await req.formData();
  const file=data.get('file');
  if(!(file instanceof File))throw new HttpError(400,'Select a valid file.');
  if(!allowed[file.type]||file.size>4*1024*1024||file.size===0)throw new HttpError(400,'Only PDF, JPG and PNG up to 4 MB are accepted.');
  const bytes=Buffer.from(await file.arrayBuffer());
  const isPdf=bytes.subarray(0,5).toString()==='%PDF-';
  const isPng=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isJpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!((file.type==='application/pdf'&&isPdf)||(file.type==='image/png'&&isPng)||(file.type==='image/jpeg'&&isJpg)))throw new HttpError(400,'The selected file does not match its type.');
  const path=`staging/${newId()}.${allowed[file.type]}`;
  await storage.bucket().file(path).save(bytes,{resumable:false,contentType:file.type,metadata:{cacheControl:'private, no-store'}});
  return json({path,fileName:file.name.slice(0,160),contentType:file.type},201);
 }catch(e){return fail(e);}
}
