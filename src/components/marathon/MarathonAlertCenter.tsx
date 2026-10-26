'use client';
import {useMemo} from 'react';
import {AlertTriangle,Bell,CalendarDays,Clock3,X} from 'lucide-react';
import type {MarathonTask} from '@/lib/marathon-types';

type Alert={task:MarathonTask;title:string;kind:'blocked'|'overdue'|'due'|'priority';rank:number};
export function MarathonAlertCenter({tasks,today,onOpen,onClose}:{
 tasks:MarathonTask[];today:string;onOpen:(task:MarathonTask)=>void;onClose:()=>void;
}){
 const alerts=useMemo(()=>{
  const fiveDays=new Date(Date.parse(today+'T12:00:00Z')+5*86400000).toISOString().slice(0,10);
  const items:Alert[]=[];
  for(const task of tasks){
   if(task.archived||task.status==='done')continue;
   let title:string,rank:number,kind:Alert['kind'];
   if(task.status==='blocked'){title='Blocked — action needed';rank=0;kind='blocked';}
   else if(task.dueDate&&task.dueDate<today){title='Overdue';rank=1;kind='overdue';}
   else if(task.dueDate&&task.dueDate<=fiveDays){title=task.dueDate===today?'Due today':'Due within 5 days';rank=2;kind='due';}
   else if(task.priority.startsWith('P1')){title='High priority';rank=3;kind='priority';}
   else continue;
   items.push({task,title,kind,rank});
  }
  return items.sort((a,b)=>a.rank-b.rank||
   (a.task.dueDate||'9999').localeCompare(b.task.dueDate||'9999')||
   a.task.id.localeCompare(b.task.id));
 },[tasks,today]);
 return <section className="ml-alert-panel" role="dialog" aria-label="Marathon reminders and urgent actions">
  <div className="ml-alert-heading">
   <div><b><Bell size={16}/> Action reminders</b><small>{alerts.length} open actions need attention</small></div>
   <button type="button" onClick={onClose} aria-label="Close reminders"><X size={18}/></button>
  </div>
  {alerts.length===0?<p className="ml-alert-empty">No urgent, blocked or upcoming actions right now.</p>:
   <div className="ml-alert-list" role="list">
    {alerts.slice(0,30).map(alert=><button type="button" key={alert.task.id}
      className={'ml-alert-item ml-alert-'+alert.kind} role="listitem"
      onClick={()=>{onClose();onOpen(alert.task);}}>
      <span className="ml-alert-icon">{alert.kind==='blocked'?<AlertTriangle size={17}/>:alert.kind==='priority'?<Bell size={17}/>:alert.kind==='overdue'?<Clock3 size={17}/>:<CalendarDays size={17}/>}</span>
      <span><b>{alert.task.title}</b><small>{alert.title}{alert.task.dueDate?' · '+alert.task.dueDate:''} · {alert.task.lead}</small></span>
    </button>)}
    {alerts.length>30&&<p className="ml-alert-empty">{alerts.length-30} additional alerts are available on the Checklist page.</p>}
   </div>}
 </section>;
}
