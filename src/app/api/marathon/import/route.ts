import seed from '@/data/marathon-seed.json';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity,requireMarathon} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req);requireMarathon(actor,'super');
  const existing=await db.collection('marathonMeta').doc('source').get();
  if(existing.exists)return json({ok:true,alreadyImported:true,created:existing.data()?.created||0});
  if(seed.items.length!==130||new Set(seed.items.map(t=>t.id)).size!==130)
   throw new HttpError(500,'Imported source checklist is incomplete.');
  const now=new Date().toISOString();
  const tasks=await db.collection('marathonTasks').get();
  const existingIds=new Set(tasks.docs.map(x=>x.id));
  const missing=seed.items.filter(t=>!existingIds.has(t.id));
  const batch=db.batch();
  for(const task of missing){
   batch.create(db.collection('marathonTasks').doc(task.id),{
    ...task,status:task.status==='done'?'done':'todo',revision:1,
    completedAt:null,archived:false,updatedAt:now,updatedBy:actor.uid
   });
  }
  batch.create(db.collection('marathonMeta').doc('source'),{
   sourceSheetId:seed.sourceSheetId,sourceTab:seed.sourceTab,
   totalSourceItems:seed.items.length,created:missing.length,importedAt:now,importedBy:actor.uid,
   eventDate:seed.eventDate
  });
  await batch.commit();
  return json({ok:true,created:missing.length,skipped:seed.items.length-missing.length,totalSourceItems:seed.items.length});
 }catch(e){return fail(e);}
}
