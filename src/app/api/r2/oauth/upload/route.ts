import {randomUUID} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sameOrigin,rateLimit} from '@/lib/security';
import {storageIdentity} from '@/lib/r2-storage';
import {authorizedOAuthObject} from '@/lib/r2-oauth';
export const runtime='nodejs';
const MAX_BYTES=3*1024*1024; // Vercel server request limit; larger files use presigned S3 upload.
const types:Record<string,string>={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'};
export async function POST(req:NextRequest){
 try{
  sameOrigin(req);const {uid}=await storageIdentity(req);
  await rateLimit(req,'r2-oauth-upload:'+uid,15,10);
  const length=Number(req.headers.get('content-length')||0);
  if(length>MAX_BYTES+300000)throw new HttpError(413,'OAuth uploads are limited to 3 MB; use a scoped bucket connection for larger files.');
  const form=await req.formData();
  const input=form.get('file');
  if(!(input instanceof File)||input.size<1||input.size>MAX_BYTES||!types[input.type]||
     !input.name.trim()||input.name.length>160)
   throw new HttpError(400,'Select a PDF, PNG or JPG up to 3 MB.');
  const bytes=new Uint8Array(await input.arrayBuffer());
  const pdf=bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
  const png=bytes.length>=8&&bytes.slice(0,8).every((x,i)=>x===[137,80,78,71,13,10,26,10][i]);
  const jpeg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!(input.type==='application/pdf'&&pdf||input.type==='image/png'&&png||
       input.type==='image/jpeg'&&jpeg))
   throw new HttpError(400,'The file signature does not match its document type.');
  const session=(await db.collection('r2OAuthSessions').doc(uid).get()).data();
  if(!session||session.status!=='connected'||!session.accountId||!session.bucket||!session.jurisdiction)
   throw new HttpError(409,'Authorize Cloudflare and select your R2 bucket first.');
  const id=randomUUID(),key='kasa/'+uid+'/personal-document/'+id+'.'+types[input.type];
  const target={accountId:String(session.accountId),bucket:String(session.bucket),
   jurisdiction:String(session.jurisdiction)},ref=db.collection('r2Files').doc(id);
  const createdAt=new Date().toISOString();
  await ref.create({ownerUid:uid,connectionId:'oauth',provider:'cloudflare-r2-rest',
   key,accountId:target.accountId,bucket:target.bucket,jurisdiction:target.jurisdiction,
   purpose:'personal-document',visibility:'private',status:'pending',writeOnce:true,
   fileName:input.name,contentType:input.type,byteSize:input.size,createdAt,updatedAt:createdAt,
   sharedWith:[],sharedWithKasa:false});
  const body=new FormData();
  body.append('body',new Blob([bytes],{type:input.type}),input.name);
  // The Cloudflare REST API accepts an object upload as multipart field "body".
  await authorizedOAuthObject(uid,'PUT',target,key,body);
  await ref.update({status:'ready',verifiedAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  return json({ok:true,fileId:id,provider:'cloudflare-r2-rest'},201);
 }catch(e){return fail(e);}
}
