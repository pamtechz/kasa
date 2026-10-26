import {randomUUID} from 'node:crypto';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sendMarathonPush} from '@/lib/mobile-push';

export const runtime='nodejs';
export const maxDuration=60;
const EVENT_DATE='2027-03-21';
const LEASE_MS=15*60*1000;

function lusakaDate(date:Date):string{
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lusaka',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
 return get('year')+'-'+get('month')+'-'+get('day');
}
function daysUntil(date:string,today:string):number{
 return Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
}
/** A failed run can be retried, and an abandoned claim expires after 15 minutes.
 * This is best-effort at-least-once delivery: a process crash after a partial
 * send can cause duplicates. Never claim exactly-once FCM delivery.
 */
export async function GET(req:Request){
 try{
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.get('authorization')!=='Bearer '+secret)throw new HttpError(401,'Unauthorized.');
  const now=new Date();
  const today=lusakaDate(now);
  if(today>EVENT_DATE)return json({ok:true,eventComplete:true,actions:0});
  const runRef=db.collection('marathonReminderRuns').doc(today);
  const runId=randomUUID();
  const claimed=await db.runTransaction(async tx=>{
   const snap=await tx.get(runRef);
   const data=snap.data()||{};
   if(data.status==='complete')return false;
   if(data.status==='started'&&typeof data.leaseExpiresAt==='string'&&data.leaseExpiresAt>now.toISOString())return false;
   tx.set(runRef,{
    status:'started',runId,
    startedAt:now.toISOString(),
    leaseExpiresAt:new Date(now.getTime()+LEASE_MS).toISOString(),
    attempts:Number(data.attempts||0)+1
   },{merge:true});
   return true;
  });
  if(!claimed)return json({ok:true,alreadyProcessed:true});
  const finish=async(status:'complete'|'failed',details:Record<string,unknown>)=>{
   // A previous crashed process must not overwrite a subsequent successful retry.
   await db.runTransaction(async tx=>{
    const snap=await tx.get(runRef);
    if(snap.data()?.runId!==runId)return;
    tx.update(runRef,{status,leaseExpiresAt:null,...details});
   });
  };
  try{
   const snap=await db.collection('marathonTasks').limit(1000).get();
   const upcoming=snap.docs.map(x=>x.data()).filter(t=>{
    if(t.archived||t.status==='done'||typeof t.dueDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(t.dueDate))return false;
    const days=daysUntil(t.dueDate,today);
    return Number.isFinite(days)&&days<=5;
   });
   if(!upcoming.length){
    await finish('complete',{completedAt:new Date().toISOString(),actions:0});
    return json({ok:true,actions:0});
   }
   const late=upcoming.filter(t=>daysUntil(t.dueDate,today)<0).length;
   const due=upcoming.filter(t=>daysUntil(t.dueDate,today)===0).length;
   const soon=upcoming.length-late-due;
   const message=[late?late+' overdue':'',due?due+' due today':'',soon?soon+' due within 5 days':''].filter(Boolean).join(' · ');
   const result=await sendMarathonPush('KASA Life Marathon — action reminders',message);
   await finish('complete',{completedAt:new Date().toISOString(),actions:upcoming.length,...result});
   return json({ok:true,actions:upcoming.length,...result});
  }catch(error){
   await finish('failed',{failedAt:new Date().toISOString()}).catch(()=>{});
   throw error;
  }
 }catch(error){return fail(error);}
}
