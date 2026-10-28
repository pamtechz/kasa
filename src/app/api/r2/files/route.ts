import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import {storageIdentity} from '@/lib/r2-storage';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const {uid}=await storageIdentity(req);
  const snap=await db.collection('r2Files').where('ownerUid','==',uid)
   .where('status','==','ready').orderBy('createdAt','desc').limit(40).get();
  return json({files:snap.docs.map(d=>({
   id:d.id,fileName:d.data().fileName,purpose:d.data().purpose,contentType:d.data().contentType,
   byteSize:d.data().byteSize,connectionId:d.data().connectionId,sharedCount:(d.data().sharedWith||[]).length,
   createdAt:d.data().createdAt
  }))});
 }catch(e){return fail(e);}
}
