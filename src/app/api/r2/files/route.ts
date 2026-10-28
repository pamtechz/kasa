import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import {storageIdentity} from '@/lib/r2-storage';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const {uid}=await storageIdentity(req);
  const snap=await db.collection('r2Files').where('ownerUid','==',uid).limit(100).get();
  return json({files:snap.docs.filter(d=>d.data().status==='ready').map(d=>({
   id:d.id,fileName:d.data().fileName,purpose:d.data().purpose,contentType:d.data().contentType,
   byteSize:d.data().byteSize,connectionId:d.data().connectionId,sharedCount:(d.data().sharedWith||[]).length,
   createdAt:d.data().createdAt
  })).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))});
 }catch(e){return fail(e);}
}
