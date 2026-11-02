import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sameOrigin,requireAppCheck} from '@/lib/security';
import {storageIdentity,resolveR2} from '@/lib/r2-storage';
import {signR2Url} from '@/lib/r2-signing';
import {loadIntake} from '@/lib/intake-server';
export const runtime='nodejs';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);const identity=await storageIdentity(req);const {uid}=identity;const {id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new HttpError(400,'Invalid upload.');
  const ref=db.collection('r2Files').doc(id);
  const snap=await ref.get(),file=snap.data();
  if(!file||file.ownerUid!==uid)throw new HttpError(404,'Upload not found.');
  if(file.purpose==='application-attachment'||(file.purpose==='cdf-document'&&identity.profile.role==='student'))await requireAppCheck(req);
  if(file.status==='ready')return json({ok:true,fileId:id,alreadyComplete:true});
  // Older pending capabilities can overwrite their key. Never promote one.
  if(file.writeOnce!==true)throw new HttpError(409,'Start a new upload to use protected file storage.');
  if(file.status!=='pending'||Date.parse(file.uploadExpiresAt)<Date.now())
   throw new HttpError(409,'The upload has expired. Start a new upload.');
  const bucket=await resolveR2(uid,file.connectionId);
  const headUrl=signR2Url(bucket,'HEAD',file.key,30);
  let head:Response;
  try{head=await fetch(headUrl,{method:'HEAD',signal:AbortSignal.timeout(10000),cache:'no-store'});}
  catch{throw new HttpError(502,'Unable to verify the uploaded object in R2.');}
  if(!head.ok)throw new HttpError(409,'Upload not found in R2. Finish the direct upload before confirming.');
  const bytes=Number(head.headers.get('content-length')||'0');
  if(bytes!==file.byteSize||head.headers.get('content-type')?.split(';')[0]?.trim()!==file.contentType)
   throw new HttpError(409,'Uploaded object size or content type does not match the expected file.');
  // Inspect first bytes without proxying the full upload through this API.
  const getUrl=signR2Url(bucket,'GET',file.key,30);
  const response=await fetch(getUrl,{headers:{Range:'bytes=0-7'},signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!response.ok)throw new HttpError(502,'Unable to inspect uploaded file signature.');
  if(response.status===200&&bytes>8)throw new HttpError(502,'R2 did not honor the range inspection; cannot safely verify file.');
  const first=new Uint8Array(await response.arrayBuffer());
  const pdf=first.length>=5&&String.fromCharCode(...first.slice(0,5))==='%PDF-';
  const png=first.length>=8&&first.slice(0,8).every((x:number,i:number)=>x===[137,80,78,71,13,10,26,10][i]);
  const jpg=first.length>=3&&first[0]===255&&first[1]===216&&first[2]===255;
  if(!(file.contentType==='application/pdf'&&pdf||file.contentType==='image/png'&&png||file.contentType==='image/jpeg'&&jpg))
   throw new HttpError(409,'Uploaded file does not match its declared content type.');
  const documentPolicy=file.purpose==='cdf-document'?await loadIntake():null;
  const submissionRef=file.purpose==='cdf-document'?db.collection('submissions').doc(file.submissionId):null;
  await db.runTransaction(async tx=>{
   const recent=await tx.get(ref),data=recent.data();
   const submission=submissionRef?await tx.get(submissionRef):null;
   if(!data||data.ownerUid!==uid)throw new HttpError(404,'Upload not found.');
   if(data.status==='ready')return;
   if(data.writeOnce!==true)throw new HttpError(409,'Start a new protected upload.');
   if(data.status!=='pending'||Date.parse(data.uploadExpiresAt)<Date.now())
    throw new HttpError(409,'This upload has expired.');
   if(submissionRef){
    const record=submission?.data(),kind=String(data.kind||'');
    if(!record||record.formKind!=='student')throw new HttpError(404,'Student application is missing.');
    if(identity.profile.role==='student'&&record.applicantUid!==uid)
     throw new HttpError(403,'Application is not linked to your account.');
    if(!['student','super_admin','admin','reviewer'].includes(identity.profile.role))
     throw new HttpError(403,'Your account cannot submit CDF documents.');
    if(['rejected','cdf_approved','cdf_funds_received','payment_verified','commission_paid'].includes(String(record.status)))
     throw new HttpError(409,'Funding documentation is locked after approval or rejection.');
    const rule=documentPolicy?.cdfRequiredDocuments.find(x=>x.id===kind);
    if(!rule)throw new HttpError(409,'This CDF document type is no longer active.');
    const now=new Date().toISOString();
    tx.update(submissionRef,{['documents.'+kind]:{
     kind,label:rule.label,path:'r2:'+id,r2FileId:id,fileName:data.fileName,
     contentType:data.contentType,size:data.byteSize,uploadedBy:uid,uploadedAt:now,verifiedAt:null,verifiedBy:null
    },updatedAt:now});
   }
   tx.update(ref,{status:'ready',...(submissionRef?{sharedWithKasa:true}:{}),verifiedAt:new Date().toISOString(),
    etag:head.headers.get('etag')||'',contentLength:bytes});
  });
  return json({ok:true,fileId:id,status:'ready'});
 }catch(e){return fail(e);}
}
