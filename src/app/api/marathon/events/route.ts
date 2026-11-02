import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
import {LEGACY_MARATHON_EVENT_ID,legacyMarathonEvent,type MarathonEvent} from '@/lib/marathon-event-model';
export const runtime='nodejs';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const create=z.object({name:z.string().trim().min(5).max(130),preparationStart:date,eventDate:date,closeoutDate:date,
 targetRunners:z.number().int().min(1).max(100000),registrationFeeMinor:z.number().int().min(0).max(10000000)});
export async function GET(req:Request){
 try{
  await marathonIdentity(req);
  const snapshot=await db.collection('marathonEvents').limit(100).get();
  const events=snapshot.docs.map(x=>({...x.data(),id:x.id} as MarathonEvent));
  if(!events.some(x=>x.id===LEGACY_MARATHON_EVENT_ID))events.unshift(legacyMarathonEvent);
  events.sort((a,b)=>a.eventDate.localeCompare(b.eventDate));
  return json({events});
 }catch(error){return fail(error);}
}
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req);
  if(actor.role!=='super_admin')throw new HttpError(403,'Only the KASA super administrator can create events.');
  const input=create.safeParse(await req.json());
  if(!input.success)throw new HttpError(400,'Check event dates, target runners and registration fee.');
  if(input.data.preparationStart>input.data.eventDate||input.data.eventDate>input.data.closeoutDate)
   throw new HttpError(400,'Preparation must start before the race, and closeout must follow the race.');
  const id='ev-'+randomUUID(),now=new Date().toISOString();
  const event:MarathonEvent={...input.data,id,status:'draft',currency:'ZMW',
   adminUids:[],budgetEditorUids:[],budgetViewerUids:[],budgetApproverUids:[],
   revision:1,createdBy:actor.uid,createdAt:now,updatedBy:actor.uid,updatedAt:now};
  const batch=db.batch();
  batch.create(db.collection('marathonEvents').doc(id),event);
  batch.create(db.collection('marathonAudit').doc(),{eventId:id,action:'event.created',at:now,actor:actor.uid,changes:event});
  await batch.commit();
  return json({event},201);
 }catch(error){return fail(error);}
}
