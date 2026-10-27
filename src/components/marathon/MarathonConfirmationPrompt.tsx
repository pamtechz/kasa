'use client';
import {useEffect,useMemo,useState} from 'react';
import {BellRing,CheckCircle2,Clock3,X} from 'lucide-react';
import {authHeaders} from '@/lib/firebase-client';
import type {MarathonTask} from '@/lib/marathon-types';

function lusakaClock(now:Date){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lusaka',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const p=(key:string)=>parts.find(x=>x.type===key)?.value||'';
 const hour=Number(p('hour'));
 return {today:p('year')+'-'+p('month')+'-'+p('day'),slot:hour>=18?'18':hour>=13?'13':hour>=8?'08':'00'};
}
export function MarathonConfirmationPrompt({uid,tasks,onConfirmed,onError}:{uid:string;tasks:MarathonTask[];onConfirmed:()=>void;onError:(message:string)=>void}){
 const [now,setNow]=useState<Date|null>(null);
 const [dismissed,setDismissed]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{setNow(new Date());const timer=window.setInterval(()=>setNow(new Date()),60000);return ()=>window.clearInterval(timer);},[]);
 const clock=useMemo(()=>now?lusakaClock(now):null,[now]);
 const task=useMemo(()=>{
  if(!clock||!uid)return null;
  const dueLimit=new Date(Date.parse(clock.today+'T12:00:00Z')+5*86400000).toISOString().slice(0,10);
  return tasks.find(t=>{
   if(t.archived||t.status==='done'||!t.assigneeUids?.includes(uid)||t.confirmationByUid?.[uid]?.status==='done')return false;
   if(!(t.importance==='Critical'||t.priority?.startsWith('P1')||t.status==='blocked'||(t.dueDate&&t.dueDate<=dueLimit)))return false;
   const key='kasa:task-prompt:'+uid+':'+t.id+':'+clock.today+':'+clock.slot;
   if(dismissed.includes(key))return false;
   try{return window.localStorage.getItem(key)!=='dismissed';}catch{return true;}
  })||null;
 },[clock,uid,tasks,dismissed]);
 if(!task||!clock)return null;
 const key='kasa:task-prompt:'+uid+':'+task.id+':'+clock.today+':'+clock.slot;
 function close(){try{window.localStorage.setItem(key,'dismissed');}catch{}setDismissed(keys=>[...keys,key]);}
 async function answer(status:'done'|'not_done'){
  if(busy)return;setBusy(true);
  try{
   const headers=await authHeaders();
   const response=await fetch('/api/marathon/tasks/'+encodeURIComponent(task!.id)+'/confirmation',{
    method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({status})
   });
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Unable to record confirmation.');
   close();onConfirmed();
  }catch(e){onError(e instanceof Error?e.message:'Unable to record confirmation.');}
  finally{setBusy(false);}
 }
 return <div className="ml-member-confirmation-backdrop" style={{position:'fixed',inset:0,background:'rgba(4,20,14,.68)',zIndex:1200,display:'grid',placeItems:'center',padding:20}}>
  <section role="alertdialog" aria-modal="true" aria-labelledby="ml-confirm-title" aria-describedby="ml-confirm-desc"
   className="ml-panel" style={{width:'min(100%,480px)',padding:24,boxShadow:'0 24px 70px #112a2745'}}>
   <header style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
    <span className="ml-eyebrow"><BellRing size={16} style={{verticalAlign:'middle'}}/> ASSIGNED TASK REMINDER</span>
    <button type="button" aria-label="Remind me later" onClick={close}><X size={20}/></button>
   </header>
   <h2 id="ml-confirm-title">Has this task been completed?</h2>
   <p id="ml-confirm-desc"><strong>{task.title}</strong><br/>Due: {task.dueDate||'Not set'} · {task.priority}</p>
   <p className="ml-form-help">Your answer is recorded with your account and time. Reporting completion does not approve or close the official checklist entry.</p>
   <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:18}}>
    <button type="button" className="ml-primary" disabled={busy} onClick={()=>void answer('done')}><CheckCircle2 size={17}/> Yes, done</button>
    <button type="button" className="ml-secondary" disabled={busy} onClick={()=>void answer('not_done')}><Clock3 size={17}/> Not done</button>
    <button type="button" className="ml-secondary" disabled={busy} onClick={close}>Remind me later</button>
   </div>
  </section>
 </div>;
}
