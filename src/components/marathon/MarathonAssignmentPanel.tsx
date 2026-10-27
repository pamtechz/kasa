'use client';
import {useEffect,useState} from 'react';
import {BellRing,Check,Users} from 'lucide-react';
import {authHeaders} from '@/lib/firebase-client';
import type {MarathonTask} from '@/lib/marathon-types';
type Member={uid:string;displayName:string;email:string;active:boolean};
type Props={task:MarathonTask;members:Member[];currentUid:string;canAssign:boolean;offline:boolean;onSaved:(task:MarathonTask)=>void;onConfirmed:()=>void;onError:(message:string)=>void};
export function MarathonAssignmentPanel({task,members,currentUid,canAssign,offline,onSaved,onConfirmed,onError}:Props){
 const [selected,setSelected]=useState<string[]>(task.assigneeUids||[]);
 const [saving,setSaving]=useState(false);
 // Keep checkbox edits across periodic bootstrap refreshes returning equivalent assignee lists.
 const assignmentKey=JSON.stringify(task.assigneeUids||[]);
 useEffect(()=>setSelected(task.assigneeUids||[]),[task.id,assignmentKey]);
 const activeMembers=members.filter(m=>m.active);
 async function save(){
  if(saving||offline)return;
  setSaving(true);
  try{
   const headers=await authHeaders();
   const response=await fetch('/api/marathon/tasks/'+encodeURIComponent(task.id)+'/assignees',{
    method:'POST',cache:'no-store',headers:{...headers,'Content-Type':'application/json'},
    body:JSON.stringify({expectedRevision:task.revision,assigneeUids:selected})
   });
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Unable to assign task.');
   onSaved(result.task);
  }catch(error){onError(error instanceof Error?error.message:'Unable to assign task.');}
  finally{setSaving(false);}
 }
 const confirmations=task.confirmationByUid||{};
 async function confirm(status:'done'|'not_done'){
  if(offline||saving)return;setSaving(true);
  try{
   const headers=await authHeaders();
   const response=await fetch('/api/marathon/tasks/'+encodeURIComponent(task.id)+'/confirmation',{
    method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({status})
   });
   const body=await response.json();if(!response.ok)throw Error(body.error||'Could not confirm task.');
   onError(body.message);onConfirmed();
  }catch(e){onError(e instanceof Error?e.message:'Unable to confirm task.');}
  finally{setSaving(false);}
 }
 return <section className="ml-panel ml-task-assignments" aria-label="Task assignments" style={{padding:20,marginBottom:16}}>
  <div className="ml-panel-head"><div><span className="ml-eyebrow">TEAM RESPONSIBILITY</span><h3><Users size={18} style={{verticalAlign:'middle'}}/> Assigned members</h3></div><span className="ml-count-badge">{(task.assigneeUids||[]).length}</span></div>
  <p className="ml-form-help">Assigned members receive a private push notification and up to three critical-task reminder prompts per day (08:00, 13:00, 18:00 Lusaka time). A member&apos;s completion report must be verified before the main checklist is closed.</p>
  {(task.assigneeUids||[]).length>0&&<ul style={{paddingLeft:20}}>
   {(task.assigneeUids||[]).map(uid=>{const member=members.find(m=>m.uid===uid);const confirmation=confirmations[uid];
    return <li key={uid}>{member?.displayName|| (uid===task.updatedBy?'Assigned member':'Member')} — <strong>{confirmation?.status==='done'?'Reported done':confirmation?.status==='not_done'?'Not yet completed':'Awaiting confirmation'}</strong></li>;
   })}
  </ul>}
  {task.status!=='done'&&task.assigneeUids?.includes(currentUid)&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}><button type="button" className="ml-primary" disabled={saving||offline} onClick={()=>void confirm('done')}><Check size={16}/> Report done</button><button type="button" className="ml-secondary" disabled={saving||offline} onClick={()=>void confirm('not_done')}>Not done yet</button></div>}
  {canAssign&&<><div className="ml-form" style={{maxHeight:220,overflowY:'auto',display:'grid',gap:8,marginBlock:12}}>
   {activeMembers.length===0&&<p className="ml-form-help">No active Marathon team members are available to assign.</p>}
   {activeMembers.map(member=><label key={member.uid} style={{display:'flex',alignItems:'center',gap:9}}>
    <input type="checkbox" disabled={saving||offline} checked={selected.includes(member.uid)}
     onChange={e=>setSelected(current=>e.target.checked?[...current,member.uid]:current.filter(uid=>uid!==member.uid))}/>
    <span>{member.displayName||member.email}</span>
   </label>)}
  </div><button className="ml-primary" disabled={saving||offline||selected.length>20} type="button" onClick={()=>void save()}>
   {saving?<BellRing size={16}/>:<Check size={16}/>} {saving?'Saving assignments…':'Save assignment & notify members'}
  </button>{selected.length>20&&<p className="error-text">Maximum 20 members per task.</p>}</>}
 </section>;
}
