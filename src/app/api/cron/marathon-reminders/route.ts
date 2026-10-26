import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sendMarathonPush} from '@/lib/mobile-push';
export const runtime='nodejs';
export const maxDuration=60;
function lusakaDate(date:Date):string{
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lusaka',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
 return get('year')+'-'+get('month')+'-'+get('day');
}
function daysUntil(date:string,today:string):number{
 return Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
}
export async function GET(req:Request){
 try{
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.get('authorization')!=='Bearer '+secret)throw new HttpError(401,'Unauthorized.');
  const today=lusakaDate(new Date());
  const runRef=db.collection('marathonReminderRuns').doc(today);
  // One daily batch even under concurrent cron invocations; no duplicate pushes.
  const claimed=await db.runTransaction(async tx=>{
   const snap=await tx.get(runRef);
   if(snap.exists)return false;
   tx.create(runRef,{startedAt:new Date().toISOString(),status:'started'});
   return true;
  });
  if(!claimed)return json({ok:true,alreadyProcessed:true});
  try{
   const snap=await db.collection('marathonTasks').limit(1000).get();
   const upcoming=snap.docs.map(x=>x.data()).filter(t=>{
    if(t.archived||t.status==='done'||typeof t.dueDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(t.dueDate))return false;
    return daysUntil(t.dueDate,today)<=5;
   });
   if(!upcoming.length){
    await runRef.update({status:'complete',completedAt:new Date().toISOString(),actions:0});
    return json({ok:true,actions:0});
   }
   const late=upcoming.filter(t=>daysUntil(t.dueDate,today)<0).length;
   const due=upcoming.filter(t=>daysUntil(t.dueDate,today)===0).length;
   const soon=upcoming.length-late-due;
   const message=[late?late+' overdue':'',due?due+' due today':'',soon?soon+' due within 5 days':''].filter(Boolean).join(' · ');
   const result=await sendMarathonPush('KASA Life Marathon — action reminders',message);
   await runRef.update({status:'complete',completedAt:new Date().toISOString(),actions:upcoming.length,...result});
   return json({ok:true,actions:upcoming.length,...result});
  }catch(error){
   await runRef.update({status:'failed',failedAt:new Date().toISOString()}).catch(()=>{});
   throw error;
  }
 }catch(error){return fail(error);}
}
