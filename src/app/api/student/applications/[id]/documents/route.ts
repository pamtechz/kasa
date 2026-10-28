import {db,storage} from '@/lib/firebase-admin';
import {signedR2Read} from '@/lib/r2-storage';
import {verifiedStudent} from '@/lib/student-access';
import {fail,json,HttpError} from '@/lib/errors';

export const runtime='nodejs';

export async function POST(){return json({error:'Use a direct upload to your authorized external storage.',code:'DIRECT_UPLOAD_REQUIRED'},410);}

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const identity=await verifiedStudent(req);
  const {id}=await params;
  if(!/^[a-zA-Z0-9_-]{8,64}$/.test(id))throw new HttpError(400,'Invalid application ID.');
  const kind=new URL(req.url).searchParams.get('kind')||'';
  if(!/^[a-z0-9_-]{2,60}$/.test(kind))throw new HttpError(400,'Invalid document type.');
  const record=await db.collection('submissions').doc(id).get();
  if(!record.exists||record.data()?.applicantUid!==identity.uid){
   throw new HttpError(404,'Application not found.');
  }
  const document=record.data()?.documents?.[kind];
  if(typeof document?.r2FileId==='string'&&document.path==='r2:'+document.r2FileId){
   const asset= (await db.collection('r2Files').doc(document.r2FileId).get()).data();
   if(!asset||asset.status!=='ready'||asset.purpose!=='cdf-document'||asset.submissionId!==id||asset.kind!==kind)
    throw new HttpError(404,'R2 document unavailable.');
   return json({url:await signedR2Read(asset.ownerUid,asset.connectionId,asset.key),expiresInSeconds:90});
  }
  if(!document?.path || !String(document.path).startsWith('cdf-documents/'+id+'/')){
   throw new HttpError(404,'Document not found.');
  }
  const [url]=await storage.bucket().file(document.path).getSignedUrl({
   action:'read',expires:Date.now()+120000
  });
  return json({url,expiresInSeconds:120});
 }catch(err){return fail(err);}
}
