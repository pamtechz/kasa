import {randomUUID} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sameOrigin,rateLimit,requireAppCheck} from '@/lib/security';
import {storageIdentity,resolveR2} from '@/lib/r2-storage';
import {signR2Url} from '@/lib/r2-signing';
import {loadIntake} from '@/lib/intake-server';
export const runtime='nodejs';
const schema=z.object({fileName:z.string().trim().min(1).max(160),
 contentType:z.enum(['image/jpeg','image/png','application/pdf']),
 byteSize:z.number().int().min(1).max(25*1024*1024),
 purpose:z.enum(['profile-photo','personal-document','cdf-document']),
 submissionId:z.string().max(64).optional(),kind:z.string().max(60).optional(),
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
  if(v.purpose==='cdf-document'){
   if(identity.profile.role==='student')await requireAppCheck(req);
   if(!v.submissionId||!v.kind||!/^[a-zA-Z0-9_-]{8,64}$/.test(v.submissionId)||!/^[a-z][a-z0-9-]{1,60}$/.test(v.kind)||v.byteSize>4*1024*1024)
    throw new HttpError(400,'CDF evidence requires a valid application, document type and 4 MB maximum.');
   const policy=await loadIntake();
   if(!policy.cdfRequiredDocuments.some(d=>d.id===v.kind))throw new HttpError(400,'Document type not configured for CDF.');
   const snap=await db.collection('submissions').doc(v.submissionId).get(),record=snap.data();
   if(!record||record.formKind!=='student'||(!['super_admin','admin','reviewer'].includes(identity.profile.role)&&
    !(identity.profile.role==='student'&&record.applicantUid===identity.uid)))
    throw new HttpError(403,'This application does not belong to your account.');
   if(['rejected','cdf_approved','cdf_funds_received','payment_verified','commission_paid'].includes(String(record.status)))
    throw new HttpError(409,'CDF evidence is locked after financial approval or rejection.');
  }
  // Regulated institutional CDF documents always use the KASA-controlled bucket.
  // A user's revocable personal BYOB connection cannot hold institutional evidence.
  const connectionId=v.purpose==='cdf-document'?'platform':(v.connectionId||'platform');
  const bucket=await resolveR2(identity.uid,connectionId);
  const id=randomUUID(),suffix=v.contentType==='image/png'?'png':v.contentType==='image/jpeg'?'jpg':'pdf';
  const key='private/'+identity.uid+'/'+v.purpose+'/'+id+'.'+suffix;
  const uploadUrl=signR2Url(bucket,'PUT',key,180,v.contentType);
  const now=new Date().toISOString();
  await db.collection('r2Files').doc(id).create({ownerUid:identity.uid,connectionId,key,
   purpose:v.purpose,fileName:v.fileName,contentType:v.contentType,byteSize:v.byteSize,
   ...(v.purpose==='cdf-document'?{submissionId:v.submissionId,kind:v.kind}:{}),
   status:'pending',writeOnce:true,visibility:'private',sharedWith:[],createdAt:now,
   uploadExpiresAt:new Date(Date.now()+5*60*1000).toISOString()});
  return json({fileId:id,uploadUrl,uploadMethod:'PUT',headers:{'Content-Type':v.contentType,'If-None-Match':'*'},
   uploadExpiresInSeconds:180,completionEndpoint:'/api/r2/uploads/'+id+'/complete'},201);
 }catch(e){return fail(e);}
}
