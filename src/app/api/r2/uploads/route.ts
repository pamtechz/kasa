import {randomUUID} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sameOrigin,rateLimit} from '@/lib/security';
import {storageIdentity,resolveR2} from '@/lib/r2-storage';
import {signR2Url} from '@/lib/r2-signing';
export const runtime='nodejs';
const schema=z.object({fileName:z.string().trim().min(1).max(160),
 contentType:z.enum(['image/jpeg','image/png','application/pdf']),
 byteSize:z.number().int().min(1).max(25*1024*1024),
 purpose:z.enum(['profile-photo','personal-document']),
 connectionId:z.string().min(1).max(100).optional()
}).strict();
export async function POST(req:NextRequest){
 try{
  sameOrigin(req);const identity=await storageIdentity(req);
  await rateLimit(req,'r2-upload:'+identity.uid,25,10);
  const parsed=schema.safeParse(await req.json().catch(()=>({})));
  if(!parsed.success)throw new HttpError(400,'Choose an image or PDF and provide an accurate byte size.');
  const v=parsed.data;
  if(v.purpose==='profile-photo'&&(!v.contentType.startsWith('image/')||v.byteSize>4*1024*1024))
   throw new HttpError(400,'Profile photos must be PNG or JPEG and no larger than 4 MB.');
  const connectionId=v.connectionId||'platform';
  const bucket=await resolveR2(identity.uid,connectionId);
  const id=randomUUID(),suffix=v.contentType==='image/png'?'png':v.contentType==='image/jpeg'?'jpg':'pdf';
  const key='private/'+identity.uid+'/'+v.purpose+'/'+id+'.'+suffix;
  const uploadUrl=signR2Url(bucket,'PUT',key,180,v.contentType);
  const now=new Date().toISOString();
  await db.collection('r2Files').doc(id).create({ownerUid:identity.uid,connectionId,key,
   purpose:v.purpose,fileName:v.fileName,contentType:v.contentType,byteSize:v.byteSize,
   status:'pending',visibility:'private',sharedWith:[],createdAt:now,
   uploadExpiresAt:new Date(Date.now()+5*60*1000).toISOString()});
  return json({fileId:id,uploadUrl,uploadMethod:'PUT',headers:{'Content-Type':v.contentType},
   uploadExpiresInSeconds:180,completionEndpoint:'/api/r2/uploads/'+id+'/complete'},201);
 }catch(e){return fail(e);}
}
