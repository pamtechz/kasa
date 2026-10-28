import 'server-only';
import {createHash,createHmac} from 'node:crypto';
export type R2Jurisdiction='default'|'eu'|'us'|'fedramp';
export type R2Credentials={
 accountId:string;bucket:string;jurisdiction:R2Jurisdiction;
 accessKeyId:string;secretAccessKey:string;
};
const safe=(s:string)=>encodeURIComponent(s).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const hmac=(key:Buffer|string,text:string)=>createHmac('sha256',key).update(text).digest();
export function validateR2Address(accountId:string,bucket:string,jurisdiction:string){
 if(!/^[a-f0-9]{32}$/i.test(accountId))throw Error('Use your 32-character Cloudflare account ID.');
 if(!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)||bucket.includes('..')||/^\d+\.\d+\.\d+\.\d+$/.test(bucket))
  throw Error('Invalid R2 bucket name.');
 if(!['default','eu','us','fedramp'].includes(jurisdiction))throw Error('Invalid R2 jurisdiction.');
}
export function r2Host(c:R2Credentials){
 validateR2Address(c.accountId,c.bucket,c.jurisdiction);
 return c.accountId+'.'+(c.jurisdiction==='default'?'':c.jurisdiction+'.')+'r2.cloudflarestorage.com';
}
/** S3 AWS Signature V4 query authorization, region auto. No SDK/large request bodies.
 * PUT capabilities are create-only: the signed If-None-Match header prevents
 * reuse from replacing the bytes after completion (including concurrent PUTs).
 */
export function signR2Url(c:R2Credentials,method:'GET'|'HEAD'|'PUT'|'DELETE',
 objectKey:string,ttlSeconds:number,contentType?:string,extraQuery:Record<string,string>={}):string{
 if(!c.accessKeyId||!c.secretAccessKey)throw Error('R2 API credentials are not configured.');
 if(ttlSeconds<1||ttlSeconds>900)throw Error('Invalid signed URL expiry.');
 if(objectKey.startsWith('/')||objectKey.includes('..')||objectKey.includes('\\')||objectKey.length>900)throw Error('Invalid R2 object key.');
 const host=r2Host(c),now=new Date(),date=now.toISOString().replace(/[:-]|\.\d{3}/g,'').slice(0,15)+'Z',day=date.slice(0,8);
 const scope=day+'/auto/s3/aws4_request';
 const uri='/'+[c.bucket,...objectKey.split('/').filter(Boolean)].map(safe).join('/');
 const query:Record<string,string>={...extraQuery,
  'X-Amz-Algorithm':'AWS4-HMAC-SHA256','X-Amz-Credential':c.accessKeyId+'/'+scope,
  'X-Amz-Date':date,'X-Amz-Expires':String(ttlSeconds),
  'X-Amz-SignedHeaders':(contentType?'content-type;host':'host')+(method==='PUT'?';if-none-match':'')};
 const queryString=Object.entries(query).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>safe(k)+'='+safe(v)).join('&');
 const canonicalHeaders=(contentType?'content-type:'+contentType.trim()+'\nhost:'+host+'\n':'host:'+host+'\n')+
  (method==='PUT'?'if-none-match:*\n':'');
 const canonical=[method,uri,queryString,canonicalHeaders,query['X-Amz-SignedHeaders'],'UNSIGNED-PAYLOAD'].join('\n');
 const signatureKey=hmac(hmac(hmac(hmac('AWS4'+c.secretAccessKey,day),'auto'),'s3'),'aws4_request');
 const signature=createHmac('sha256',signatureKey).update(['AWS4-HMAC-SHA256',date,scope,sha(canonical)].join('\n')).digest('hex');
 return 'https://'+host+uri+'?'+queryString+'&X-Amz-Signature='+signature;
}
