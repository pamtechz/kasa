import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sameOrigin,audit} from '@/lib/security';
import {storageIdentity} from '@/lib/r2-storage';

export const runtime='nodejs';
const schema=z.object({approved:z.boolean()}).strict();

/** Explicit, revocable owner consent to a single user-owned document.
 * This never grants a staff member access to a whole customer bucket.
 */
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);
  const {uid}=await storageIdentity(req);
  const {id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new HttpError(400,'Invalid file identifier.');
  const parsed=schema.safeParse(await req.json().catch(()=>({})));
  if(!parsed.success)throw new HttpError(400,'Approve or revoke KASA access.');
  const ref=db.collection('r2Files').doc(id),grant=db.collection('r2InstitutionShares').doc(id);
  const now=new Date().toISOString();
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref),file=snap.data();
   if(!file||file.ownerUid!==uid||file.status!=='ready'||file.purpose!=='personal-document')
    throw new HttpError(404,'Only your completed private documents may be shared with KASA.');
   // Retain the document owner/bucket: granting access does not copy objects.
   tx.update(ref,{sharedWithKasa:parsed.data.approved,updatedAt:now});
   if(parsed.data.approved){
    tx.set(grant,{fileId:id,ownerUid:uid,sharedAt:now,updatedAt:now});
   }else{
    tx.delete(grant);
   }
  });
  await audit(uid,parsed.data.approved?'r2.kasa_access_granted':'r2.kasa_access_revoked',id,{purpose:'personal-document'}).catch(()=>{});
  return json({ok:true,fileId:id,sharedWithKasa:parsed.data.approved});
 }catch(e){return fail(e);}
}
