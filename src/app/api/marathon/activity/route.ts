import {db} from '@/lib/firebase-admin';
import {marathonIdentity} from '@/lib/marathon';
import {getMarathonEvent,requireBudgetAccess} from '@/lib/marathon-event-server';
import {LEGACY_MARATHON_EVENT_ID} from '@/lib/marathon-event-model';
import {fail,json} from '@/lib/errors';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const identity=await marathonIdentity(req);
  const eventId=new URL(req.url).searchParams.get('event');
  const selectedEvent=eventId?await getMarathonEvent(eventId):null;
  const snap=await db.collection('marathonAudit').orderBy('at','desc').limit(250).get();
  const records=snap.docs.map(d=>({id:d.id,...d.data()} as Record<string,unknown>));
  // Financial logs must not leak to members without explicit event-level read permission.
  const financialEventIds=[...new Set(records.filter(record=>
   typeof record.action==='string'&&record.action.startsWith('budget.')
  ).map(record=>typeof record.eventId==='string'?record.eventId:LEGACY_MARATHON_EVENT_ID))];
  const budgetVisibility=new Map<string,boolean>();
  await Promise.all(financialEventIds.map(async id=>{
   try{
    const event=selectedEvent?.id===id?selectedEvent:await getMarathonEvent(id);
    requireBudgetAccess(identity,event,'read');
    budgetVisibility.set(id,true);
   }catch{budgetVisibility.set(id,false);}
  }));
  const filtered=records.filter(record=>{
   const recordEvent=typeof record.eventId==='string'?record.eventId:LEGACY_MARATHON_EVENT_ID;
   if(selectedEvent&&recordEvent!==selectedEvent.id)return false;
   if(typeof record.action==='string'&&record.action.startsWith('budget.'))
    return budgetVisibility.get(recordEvent)===true;
   return true;
  });
  return json({events:filtered.slice(0,150)});
 }catch(e){return fail(e);}
}
