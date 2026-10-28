'use client';
import {authHeaders} from './firebase-client';
type Purpose='profile-photo'|'personal-document'|'cdf-document';
type Start={fileId:string;uploadUrl:string;headers:Record<string,string>;completionEndpoint:string};
async function r2Json<T>(path:string,body:unknown):Promise<T>{
 const headers=await authHeaders();
 const res=await fetch(path,{method:'POST',headers:{...headers,'Content-Type':'application/json'},
  body:JSON.stringify(body),cache:'no-store'});
 const result=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(result.error||'R2 request failed.');
 return result as T;
}
/** File bytes go directly to the presigned Cloudflare R2 endpoint. */
export async function uploadToR2(file:File,purpose:Purpose,connectionId?:string,context?:{submissionId:string;kind:string}):Promise<string>{
 const started=await r2Json<Start>('/api/r2/uploads',{fileName:file.name,
  contentType:file.type,byteSize:file.size,purpose,...(connectionId?{connectionId}:{}),...context});
 const response=await fetch(started.uploadUrl,{method:'PUT',body:file,headers:started.headers});
 if(!response.ok)throw Error('Cloudflare R2 upload failed ('+response.status+'). Verify bucket CORS and permissions.');
 await r2Json(started.completionEndpoint,{});
 return started.fileId;
}
export async function r2ReadUrl(id:string):Promise<string>{
 const headers=await authHeaders();
 const response=await fetch('/api/r2/files/'+encodeURIComponent(id)+'/read',{headers,cache:'no-store'});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'File access denied.');
 return result.url;
}

/** Institutional CDF evidence always uses KASA's controlled R2 bucket.
 * During staged migration only, keep the existing Firebase upload route as fallback
 * when R2 platform credentials have not yet been configured.
 */
export async function uploadCdfDocumentDirect(file:File,submissionId:string,kind:string):Promise<boolean>{
 const headers=await authHeaders();
 const response=await fetch('/api/r2/connections',{headers,cache:'no-store'});
 if(!response.ok)throw Error('Unable to check KASA institutional file storage.');
 const config=await response.json();
 if(!config.platformAvailable)return false;
 await uploadToR2(file,'cdf-document','platform',{submissionId,kind});
 return true;
}
