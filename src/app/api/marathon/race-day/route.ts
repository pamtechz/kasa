import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sameOrigin} from '@/lib/security';
import {marathonIdentity} from '@/lib/marathon';
import {getMarathonEvent,requireEventTaskEdit} from '@/lib/marathon-event-server';
import {raceDaySummary} from '@/lib/marathon-race-day';
import type {RaceDayEntry} from '@/lib/marathon-race-day';
export const runtime='nodejs';
const kind=z.enum(['bib_station','volunteers','medical_team','route_safety','water_station','timing_desk','other']);
const status=z.enum(['planned','ready','active','blocked','resolved']);
const id=z.string().regex(/^[A-Za-z0-9_-]{8,80}$/);
const create=z.object({eventId:id,kind,title:z.string().trim().min(4).max(100),
 zone:z.string().trim().min(2).max(80),note:z.string().trim().max(500).default(''),
 status:status.default('planned')}).strict();
const update=z.object({id:id,eventId:id,expectedRevision:z.number().int().min(0),
 changes:z.object({status:status.optional(),title:z.string().trim().min(4).max(100).optional(),
 zone:z.string().trim().min(2).max(80).optional(),note:z.string().trim().max(500).optional()}).strict()
 .refine(x=>Object.keys(x).length>0)}).strict();
async function access(req:Request,eventId:string){
 const actor=await marathonIdentity(req),event=await getMarathonEvent(eventId);
 let canWrite=false;
 try{requireEventTaskEdit(actor,event);canWrite=!['completed','archived','cancelled'].includes(event.status);}catch{}
 return {actor,event,canWrite};
}
export async function GET(req:Request){
 try{
  const eventId=new URL(req.url).searchParams.get('event')||'';
  if(!id.safeParse(eventId).success)throw new HttpError(400,'Choose a valid Marathon event.');
  const {event,canWrite}=await access(req,eventId);
  const snap=await db.collection('marathonRaceDayItems').where('eventId','==',eventId).limit(251).get();
  const entries=snap.docs.slice(0,250).map(doc=>({id:doc.id,...doc.data()} as RaceDayEntry));
  entries.sort((a,b)=>a.kind.localeCompare(b.kind)||a.zone.localeCompare(b.zone));
  return json({event,entries,canWrite,partial:snap.size>250,summary:raceDaySummary(entries)});
 }catch(e){return fail(e);}
}
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const parsed=create.safeParse(await req.json());if(!parsed.success)throw new HttpError(400,'Check station type, zone, and task description.');
  const {actor,event,canWrite}=await access(req,parsed.data.eventId);
  if(!canWrite)throw new HttpError(403,'This event is closed or you are not assigned to edit its race-day operations.');
  const now=new Date().toISOString(),ref=db.collection('marathonRaceDayItems').doc('rd-'+randomUUID());
  const item:RaceDayEntry={...parsed.data,id:ref.id,revision:1,createdAt:now,createdBy:actor.uid,updatedAt:now,updatedBy:actor.uid};
  const batch=db.batch();batch.create(ref,item);
  batch.create(db.collection('marathonAudit').doc(),{eventId:event.id,action:'race_day.created',
   target:ref.id,actor:actor.uid,at:now,changes:{kind:item.kind,zone:item.zone,status:item.status}});
  await batch.commit();return json({entry:item},201);
 }catch(e){return fail(e);}
}
export async function PATCH(req:Request){
 try{
  sameOrigin(req);
  const parsed=update.safeParse(await req.json());if(!parsed.success)throw new HttpError(400,'Invalid race-day record or revision.');
  const {actor,event,canWrite}=await access(req,parsed.data.eventId);
  if(!canWrite)throw new HttpError(403,'Event is closed or you lack edit access.');
  const ref=db.collection('marathonRaceDayItems').doc(parsed.data.id),at=new Date().toISOString();
  let result:RaceDayEntry|null=null;
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref),previous=snap.data() as RaceDayEntry|undefined;
   if(!previous||previous.eventId!==event.id)throw new HttpError(404,'Race-day record not found in this event.');
   if(previous.revision!==parsed.data.expectedRevision)throw new HttpError(409,'Another staff member updated this checkpoint. Refresh before saving.');
   result={...previous,...parsed.data.changes,revision:previous.revision+1,updatedAt:at,updatedBy:actor.uid};
   tx.update(ref,result);
   tx.create(db.collection('marathonAudit').doc(),{eventId:event.id,action:'race_day.updated',
    target:ref.id,actor:actor.uid,at,changes:parsed.data.changes,
    before:{status:previous.status,revision:previous.revision}});
  });
  return json({entry:result});
 }catch(e){return fail(e);}
}
