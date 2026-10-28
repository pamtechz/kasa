import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sameOrigin,audit} from '@/lib/security';
import {storageIdentity} from '@/lib/r2-storage';
export const runtime='nodejs';
const schema=z.object({sharedWith:z.array(z.string().min(1).max(128)).max(20)}).strict();
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);const {uid}=await storageIdentity(req),{id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new HttpError(400,'Invalid file identifier.');
  const input=schema.safeParse(await req.json().catch(()=>({})));
  if(!input.success)throw new HttpError(400,'Select up to 20 registered KASA users.');
  const targets=[...new Set(input.data.sharedWith.filter(x=>x!==uid))];
  // Only share with existing active registered profiles, never arbitrary email strings.
  for(const target of targets){
   const p=await db.collection('profiles').doc(target).get();
   if(!p.exists||p.data()?.active!==true)throw new HttpError(400,'Recipient must be an active KASA account.');
  }
  const ref=db.collection('r2Files').doc(id);
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref),data=snap.data();
   if(!data||data.ownerUid!==uid||data.status!=='ready')throw new HttpError(404,'Owned file not found.');
   if(data.purpose==='profile-photo')throw new HttpError(409,'Profile photos cannot be shared as confidential documents.');
   tx.update(ref,{sharedWith:targets,updatedAt:new Date().toISOString()});
  });
  await audit(uid,'r2.file_shared',id,{recipientCount:targets.length}).catch(()=>{});
  return json({ok:true,sharedWith:targets});
 }catch(e){return fail(e);}
}
