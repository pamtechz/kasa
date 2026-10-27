import {randomUUID} from 'node:crypto';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sendMarathonPush} from '@/lib/mobile-push';
import type {MarathonTask} from '@/lib/marathon-types';

export const runtime='nodejs';
export const maxDuration=60;
const EVENT_DATE='2027-03-21';
const LEASE_MS=15*60*1000;
const SLOTS=[8,13,18] as const; // Lusaka UTC+2: Vercel at 06 UTC; GitHub Actions at 11 and 16 UTC.

function lusakaParts(date:Date):{today:string;hour:number}{
 const parts=new Intl.DateTimeFormat('en-GB',{
  timeZone:'Africa/Lusaka',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'
 }).formatToParts(date);
 const part=(key:string)=>parts.find(p=>p.type===key)?.value||'';
 return {today:part('year')+'-'+part('month')+'-'+part('day'),hour:Number(part('hour'))};
}
function daysUntil(date:string,today:string):number{
 return Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
}
function requiresReminder(task:MarathonTask,today:string):boolean{
 if(task.archived||task.status==='done')return false;
 const days=typeof task.dueDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)?
  daysUntil(task.dueDate,today):Infinity;
 return days<=5||task.priority?.startsWith('P1')||task.importance==='Critical'||task.status==='blocked';
}
/** 3 independently leased runs each day. Push is best-effort, not exactly-once; FCM needs
 * a registered device and can still fail downstream. Never include task details on lock screens.
 */
export async function GET(req:Request){
 try{
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.get('authorization')!=='Bearer '+secret)throw new HttpError(401,'Unauthorized.');
  const now=new Date();
  const {today,hour}=lusakaParts(now);
  if(today>EVENT_DATE)return json({ok:true,eventComplete:true,actions:0});
  const requestedSlot=new URL(req.url).searchParams.get('slot');
  // Scheduled GitHub jobs identify their intended window explicitly. A delayed
  // 13:00 job must not consume the 18:00 reminder lease.
  if(requestedSlot!==null&&!['13','18'].includes(requestedSlot))throw new HttpError(400,'Invalid scheduled reminder slot.');
  const slot=requestedSlot!==null?Number(requestedSlot):[...SLOTS].reverse().find(value=>hour>=value);
  if(!slot)return json({ok:true,skipped:true,reason:'Before first Lusaka reminder window'});
  if(hour<slot)throw new HttpError(409,'Reminder window has not started in Lusaka.');
  const runRef=db.collection('marathonReminderRuns').doc(today+'-'+slot);
  const runId=randomUUID();
  const claimed=await db.runTransaction(async tx=>{
   const snap=await tx.get(runRef);
   const data=snap.data()||{};
   if(data.status==='complete')return false;
   if(data.status==='started'&&typeof data.leaseExpiresAt==='string'&&data.leaseExpiresAt>now.toISOString())return false;
   tx.set(runRef,{status:'started',runId,startedAt:now.toISOString(),
    leaseExpiresAt:new Date(now.getTime()+LEASE_MS).toISOString(),attempts:Number(data.attempts||0)+1},{merge:true});
   return true;
  });
  if(!claimed)return json({ok:true,alreadyProcessed:true,slot});
  const finish=async(status:'complete'|'failed',details:Record<string,unknown>)=>{
   await db.runTransaction(async tx=>{
    const snap=await tx.get(runRef);
    if(snap.data()?.runId!==runId)return;
    tx.update(runRef,{status,leaseExpiresAt:null,...details});
   });
  };
  try{
   const snap=await db.collection('marathonTasks').limit(1000).get();
   const tasks=snap.docs.map(x=>({id:x.id,...x.data()} as MarathonTask)).filter(t=>requiresReminder(t,today));
   const recipients=new Map<string,number>();
   for(const task of tasks){
    for(const uid of new Set(task.assigneeUids||[])){
     if(typeof uid!=='string'||!uid||task.confirmationByUid?.[uid]?.status==='done')continue;
     recipients.set(uid,(recipients.get(uid)||0)+1);
    }
   }
   let delivered=0,failed=0;
   // Send a single grouped notification per member per slot, not one per checklist item.
   for(const [uid,count] of recipients){
    const result=await sendMarathonPush('KASA Life Marathon — task reminder',
     count===1?'An assigned task needs your status confirmation.':'You have '+count+' assigned tasks needing confirmation.',
     '/marathon/operations',uid);
    delivered+=result.delivered;failed+=result.failed;
   }
   await finish('complete',{completedAt:new Date().toISOString(),slot,
    actions:tasks.length,recipients:recipients.size,delivered,failed});
   return json({ok:true,slot,actions:tasks.length,recipients:recipients.size,delivered,failed});
  }catch(error){
   await finish('failed',{failedAt:new Date().toISOString()}).catch(()=>{});
   throw error;
  }
 }catch(error){return fail(error);}
}
