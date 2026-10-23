import {db} from '@/lib/firebase-admin';
import {marathonIdentity} from '@/lib/marathon';
import {fail,json} from '@/lib/errors';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  await marathonIdentity(req);
  const snap=await db.collection('marathonAudit').orderBy('at','desc').limit(150).get();
  return json({events:snap.docs.map(d=>({id:d.id,...d.data()}))});
 }catch(e){return fail(e);}
}
