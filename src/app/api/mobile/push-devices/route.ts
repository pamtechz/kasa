import {createHash} from 'node:crypto';
import {db} from '@/lib/firebase-admin';
import {operator,sameOrigin} from '@/lib/security';
import {fail,json,HttpError} from '@/lib/errors';
import type {Profile} from '@/lib/types';

export const runtime='nodejs';
const roles=['super_admin','admin','reviewer','finance','agent','student'] as const;
function deviceId(token:string){return createHash('sha256').update(token).digest('hex');}
function validateToken(token:unknown):string{
 if(typeof token!=='string'||token.length<30||token.length>4096||!/^[-_:.A-Za-z0-9]+$/.test(token))
  throw new HttpError(400,'Invalid Firebase messaging token.');
 return token;
}
export async function POST(req:Request){
 try{
  sameOrigin(req);
  // Reuse the school session and profile; never trust a role from the mobile app.
  const profile=await operator(req,[...roles]) as Profile & {uid:string};
  const body=await req.json();
  const token=validateToken(body?.token);
  const ref=db.collection('mobilePushDevices').doc(deviceId(token));
  const now=new Date().toISOString();
  const marathon=profile.role==='super_admin'||profile.marathonAccess?.active===true;
  await ref.set({uid:profile.uid,token,platform:'flutter',marathon,updatedAt:now},{merge:true});
  return json({ok:true,marathon});
 }catch(error){return fail(error);}
}
export async function DELETE(req:Request){
 try{
  sameOrigin(req);
  const profile=await operator(req,[...roles]) as Profile & {uid:string};
  const token=validateToken((await req.json())?.token);
  const ref=db.collection('mobilePushDevices').doc(deviceId(token));
  const snap=await ref.get();
  if(snap.exists&&snap.data()?.uid!==profile.uid)throw new HttpError(403,'Device belongs to another account.');
  if(snap.exists)await ref.delete();
  return json({ok:true});
 }catch(error){return fail(error);}
}
