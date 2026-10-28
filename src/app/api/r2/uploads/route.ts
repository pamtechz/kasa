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
 purpose:z.enum(['profile-photo','personal-document','cdf-document','acceptance-pdf','application-attachment','public-media','enrollment-pdf']),
 submissionId:z.string().max(64).optional(),kind:z.string().max(60).optional(),
 formSlug:z.string().regex(/^[a-z0-9-]{1,120}$/).optional(),
 connectionId:z.string().min(1).max(100).optional()
}).strict();
export async function POST(req:NextRequest){
 try{
  sameOrigin(req);const identity=await storageIdentity(req);
  await rateLimit(req,'r2-upload:'+identity.uid,25,10);
  const parsed=schema.safeParse(await req.json().catch(()=>({})));
  if(!parsed.success)throw new HttpError(400,'Choose an image or PDF and provide an accurate byte size.');
  const v=parsed.data;
  if(identity.guest&&v.purpose!=='application-attachment')throw new HttpError(403,'Applicant storage is limited to application attachments.');
  if(v.purpose==='profile-photo'&&(!v.contentType.startsWith('image/')||v.byteSize>4*1024*1024))
   throw new HttpError(400,'Profile photos must be PNG or JPEG and no larger than 4 MB.');
  if(['acceptance-pdf','enrollment-pdf','public-media'].includes(v.purpose)&&!['super_admin','admin'].includes(identity.profile.role))
   throw new HttpError(403,'Only administrators may publish official documents and media.');
  if(['acceptance-pdf','enrollment-pdf'].includes(v.purpose)&&v.contentType!=='application/pdf')
   throw new HttpError(400,'Choose a PDF document.');
  if(v.purpose==='public-media'&&(!v.contentType.startsWith('image/')||v.byteSize>4*1024*1024))
   throw new HttpError(400,'Choose a PNG or JPG banner up to 4 MB.');
  if(v.purpose==='application-attachment'){
   await requireAppCheck(req);
   if(v.byteSize>4*1024*1024||!v.formSlug)throw new HttpError(400,'Choose an application file up to 4 MB.');
   const form=await db.collection('forms').where('slug','==',v.formSlug).where('published','==',true).limit(1).get();
   if(form.empty)throw new HttpError(404,'Application form is unavailable.');
  }
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
  const session=(await db.collection('r2OAuthSessions').doc(identity.uid).get()).data();
  const ownConnections=await db.collection('r2Connections').where('ownerUid','==',identity.uid).limit(25).get();
  const active=ownConnections.docs.filter(d=>d.data().status==='active');
  const connectionId=v.connectionId||session?.connectionId||active[0]?.id;
  if(!connectionId||connectionId==='platform'||!active.some(d=>d.id===connectionId))
   throw new HttpError(409,'Connect your own Cloudflare storage before uploading.');
  const bucket=await resolveR2(identity.uid,connectionId);
  const id=randomUUID(),suffix=v.contentType==='image/png'?'png':v.contentType==='image/jpeg'?'jpg':'pdf';
  const key='private/'+identity.uid+'/'+v.purpose+'/'+id+'.'+suffix;
  const uploadUrl=signR2Url(bucket,'PUT',key,180,v.contentType);
  const now=new Date().toISOString();
  await db.collection('r2Files').doc(id).create({ownerUid:identity.uid,connectionId,key,
   purpose:v.purpose,fileName:v.fileName,contentType:v.contentType,byteSize:v.byteSize,
   ...(v.purpose==='cdf-document'?{submissionId:v.submissionId,kind:v.kind}:{}),
   ...(v.formSlug?{formSlug:v.formSlug}:{}),
   status:'pending',writeOnce:true,visibility:'private',sharedWith:[],createdAt:now,
   uploadExpiresAt:new Date(Date.now()+5*60*1000).toISOString()});
  return json({fileId:id,uploadUrl,uploadMethod:'PUT',headers:{'Content-Type':v.contentType,'If-None-Match':'*'},
   uploadExpiresInSeconds:180,completionEndpoint:'/api/r2/uploads/'+id+'/complete'},201);
 }catch(e){return fail(e);}
}
