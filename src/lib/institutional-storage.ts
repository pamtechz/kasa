import 'server-only';
import {HttpError} from './errors';
import {platformR2} from './r2-storage';
import {signR2Url} from './r2-signing';

// Private namespaces prevent supplied paths from reaching unrelated objects.
export const R2_STAGING=/^r2-staging\/[a-f0-9-]{36}\.(?:pdf|jpg|png)$/i;
export const R2_ACCEPTANCE=/^r2-acceptance-pack\/[a-f0-9-]{36}-[a-zA-Z0-9._-]{1,140}$/i;
function configured(path:string){
 if(!R2_STAGING.test(path)&&!R2_ACCEPTANCE.test(path))
  throw new HttpError(403,'Unrecognized institutional object path.');
 const bucket=platformR2();
 if(!bucket)throw new HttpError(503,'KASA institutional R2 storage is not configured.');
 return bucket;
}
export async function uploadInstitutionalObject(path:string,bytes:Buffer,contentType:string){
 const url=signR2Url(configured(path),'PUT',path,120,contentType);
 let result:Response;
 try{
  result=await fetch(url,{method:'PUT',body:new Uint8Array(bytes),headers:{
   'Content-Type':contentType,'If-None-Match':'*'
  },redirect:'error',signal:AbortSignal.timeout(20000),cache:'no-store'});
 }catch{throw new HttpError(502,'Cloudflare R2 institutional upload was interrupted.');}
 if(!result.ok)throw new HttpError(502,'Cloudflare R2 rejected the institutional upload.');
}
export async function institutionalObjectHead(path:string):Promise<{size:number;contentType:string;lastModified:string}>{
 let res:Response;
 try{
  res=await fetch(signR2Url(configured(path),'HEAD',path,30),{method:'HEAD',
   redirect:'error',signal:AbortSignal.timeout(10000),cache:'no-store'});
 }catch{throw new HttpError(502,'Unable to verify institutional R2 object.');}
 if(!res.ok)throw new HttpError(400,'Institutional attachment is missing or unavailable.');
 return {size:Number(res.headers.get('content-length')||'0'),
  contentType:String(res.headers.get('content-type')||'').split(';')[0].trim(),
  lastModified:String(res.headers.get('last-modified')||'')};
}
export function institutionalReadUrl(path:string):string {
 return signR2Url(configured(path),'GET',path,90);
}
export async function readInstitutionalObject(path:string,maxBytes:number):Promise<Buffer>{
 const meta=await institutionalObjectHead(path);
 if(!Number.isFinite(meta.size)||meta.size<1||meta.size>maxBytes)
  throw new HttpError(413,'Institutional file exceeds the permitted size.');
 let response:Response;
 try{response=await fetch(institutionalReadUrl(path),{redirect:'error',
   signal:AbortSignal.timeout(20000),cache:'no-store'});}
 catch{throw new HttpError(502,'Unable to download institutional R2 object.');}
 if(!response.ok)throw new HttpError(502,'Institutional file download failed.');
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length!==meta.size||bytes.length>maxBytes)
  throw new HttpError(422,'Institutional file size changed while downloading.');
 return bytes;
}
