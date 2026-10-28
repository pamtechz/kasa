import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sameOrigin} from '@/lib/security';
import {storageIdentity,signedR2Read} from '@/lib/r2-storage';
export const runtime='nodejs';
export async function PATCH(req:Request){
 try{
  sameOrigin(req);const {uid}=await storageIdentity(req);
  const body=await req.json().catch(()=>({}));
  const fileId=body?.fileId;
  if(typeof fileId!=='string'||!/^[a-f0-9-]{36}$/i.test(fileId))throw new HttpError(400,'Invalid image asset ID.');
  const asset=await db.collection('r2Files').doc(fileId).get(),data=asset.data();
  if(!data||data.ownerUid!==uid||data.status!=='ready'||data.purpose!=='profile-photo')
   throw new HttpError(403,'Only your completed profile photo upload can be attached.');
  const profile=db.collection('profiles').doc(uid);
  await profile.update({photoAssetId:fileId,photoUrl:'',updatedAt:new Date().toISOString()});
  return json({ok:true,fileId});
 }catch(e){return fail(e);}
}
export async function GET(req:Request){
 try{
  const {uid,profile}=await storageIdentity(req);
  if(!profile.photoAssetId)return json({photoAssetId:null,url:null});
  const doc=await db.collection('r2Files').doc(profile.photoAssetId).get(),a=doc.data();
  if(!a||a.ownerUid!==uid||a.status!=='ready')return json({photoAssetId:null,url:null});
  return json({photoAssetId:profile.photoAssetId,url:await signedR2Read(uid,a.connectionId,a.key),expiresInSeconds:90});
 }catch(e){return fail(e);}
}
