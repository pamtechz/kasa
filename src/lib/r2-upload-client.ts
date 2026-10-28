'use client';
import {getClientAuth,appCheckToken} from './firebase-client';
export type Purpose='profile-photo'|'personal-document'|'cdf-document'|'acceptance-pdf'|'application-attachment'|'public-media'|'enrollment-pdf';
type Start={fileId:string;uploadUrl:string;headers:Record<string,string>;completionEndpoint:string};
export async function externalStorageHeaders():Promise<Record<string,string>>{
 const user=getClientAuth()?.currentUser;
 return user?{Authorization:'Bearer '+await user.getIdToken()}:{};
}
export async function storageJson<T>(path:string,body?:unknown,attest=false):Promise<T>{
 const headers=await externalStorageHeaders(),token=attest?await appCheckToken():'';
 const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{...headers,
  ...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{'X-Firebase-AppCheck':token}:{})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'Storage request failed.');
 return result as T;
}
export async function authorizeExternalStorage(){
 if(!getClientAuth()?.currentUser)await storageJson('/api/r2/guest',{},true);
 const result=await storageJson<{url:string}>('/api/r2/oauth/start',{returnTo:location.pathname+location.search});
 location.assign(result.url);
}
/** File bytes are sent only to the fixed Cloudflare S3 origin. */
export async function uploadToR2(file:File,purpose:Purpose,connectionId?:string,context?:{submissionId?:string;kind?:string;formSlug?:string}):Promise<string>{
 const started=await storageJson<Start>('/api/r2/uploads',{fileName:file.name,
  contentType:file.type,byteSize:file.size,purpose,...(connectionId?{connectionId}:{}),...context},
  purpose==='cdf-document'||purpose==='application-attachment');
 const target=new URL(started.uploadUrl);
 if(target.protocol!=='https:'||! /^[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com$/.test(target.hostname))
  throw Error('The upload destination is not Cloudflare storage.');
 const response=await fetch(target,{method:'PUT',body:file,headers:started.headers,credentials:'omit',redirect:'error'});
 if(!response.ok)throw Error('External upload failed. Check your Cloudflare connection and try again.');
 await storageJson(started.completionEndpoint,{},purpose==='cdf-document'||purpose==='application-attachment');
 return started.fileId;
}
export async function r2ReadUrl(id:string):Promise<string>{
 const result=await storageJson<{url:string}>('/api/r2/files/'+encodeURIComponent(id)+'/read');
 return result.url;
}
export async function uploadCdfDocumentDirect(file:File,submissionId:string,kind:string):Promise<void>{
 await uploadToR2(file,'cdf-document',undefined,{submissionId,kind});
}
