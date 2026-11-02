import {storage,db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator} from '@/lib/security';
import {signedR2Read} from '@/lib/r2-storage';
import {R2_STAGING,institutionalReadUrl} from '@/lib/institutional-storage';
export const runtime='nodejs';
export async function GET(req:Request){try{
 await operator(req,['super_admin','admin','reviewer']);
 const u=new URL(req.url);const id=u.searchParams.get('submissionId')||'';
 const field=u.searchParams.get('fieldId')||'';
 if(!/^[a-z0-9-]{36}$/i.test(id)||!/^[a-zA-Z0-9_-]{2,90}$/.test(field))throw new HttpError(400,'Invalid file request.');
 const snap=await db.collection('submissions').doc(id).get();
 const v=snap.data()?.answers?.[field];
 if(v&&typeof v.path==='string'&&/^r2:[a-f0-9-]{36}$/i.test(v.path)){
  const asset=(await db.collection('r2Files').doc(v.path.slice(3)).get()).data();
  if(!asset||asset.status!=='ready'||asset.purpose!=='application-attachment'||asset.submissionId!==id||asset.sharedWithKasa!==true)
   throw new HttpError(404,'Application attachment unavailable.');
  return json({url:await signedR2Read(asset.ownerUid,asset.connectionId,asset.key),expiresInSeconds:90});
 }
 if(!v||typeof v.path!=='string'||!(R2_STAGING.test(v.path)||/^staging\/[a-f0-9-]{36}\.(pdf|jpg|png)$/i.test(v.path)))throw new HttpError(404,'Attachment not found.');
 const url=R2_STAGING.test(v.path)?institutionalReadUrl(v.path):
  (await storage.bucket().file(v.path).getSignedUrl({action:'read',expires:Date.now()+3*60_000}))[0];
 return json({url});
}catch(e){return fail(e);}}
