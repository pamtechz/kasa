'use client';
import {useState} from 'react';
import {ArrowRight,ShieldCheck} from 'lucide-react';
import type {MarathonSeedInfo} from '@/lib/marathon-seed-import';

type Plan={version:string;sourceName:string;planHash:string;alreadyImported:boolean;totalSourceItems:number;created:number;updated:number;archived:number;preservedFields:{id:string;fields:string[]}[]};
type Requester=<T>(path:string,init?:RequestInit)=>Promise<T>;
export function MarathonSeedImport({source,meta,taskCount,offline,request,onApplied}:{source:MarathonSeedInfo|null;meta:Record<string,unknown>|null;taskCount:number;offline:boolean;request:Requester;onApplied:()=>Promise<void>}){
 const [plan,setPlan]=useState<Plan|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const current=!!source&&meta?.version===source.version;
 async function review(){
  setBusy(true);setMessage('');
  try{const result=await request<Plan>('/api/marathon/import');setPlan(result);if(result.alreadyImported){setMessage('This checklist version has already been imported.');await onApplied();}}
  catch(e){setMessage(e instanceof Error?e.message:'Unable to review this import.');}finally{setBusy(false);}
 }
 async function apply(){
  if(!plan||plan.alreadyImported)return;
  setBusy(true);setMessage('');
  try{
   const result=await request<Plan>('/api/marathon/import',{method:'POST',body:JSON.stringify({version:plan.version,planHash:plan.planHash})});
   setPlan(null);setMessage(result.alreadyImported?'This checklist version has already been imported.':`Checklist applied: ${result.created} added, ${result.updated} updated and ${result.archived} moved to the recoverable archive.`);
   await onApplied();
  }catch(e){setPlan(null);setMessage(e instanceof Error?e.message:'Unable to apply this import.');}finally{setBusy(false);}
 }
 return <section className="ml-panel"><div className="ml-panel-head"><div><span className="ml-eyebrow">DATA FOUNDATION</span><h3>Updated source checklist</h3></div><ShieldCheck size={22}/></div>
  <p className="ml-panel-description">{source?.sourceName||'Reconnect to load the current source checklist.'} Existing completion history, notes and evidence are retained. Superseded source records move to the recoverable archive.</p>
  <div className="ml-import-summary"><div><small>Source actions</small><b>{source?.itemCount??'—'}</b></div><div><small>Firestore records</small><b>{taskCount}</b></div><div><small>Checklist</small><b>{current?'Current':'Update available'}</b></div></div>
  {source&&<p className="ml-form-help">{source.sectionCount} workstreams · {source.completedCount} marked Done in the document · {source.correctedDateCount} deadline years corrected to 2027 with approval. The document does not supply actual completion times.</p>}
  {message&&<p className="ml-notice" role="status">{message}</p>}
  {plan&&!plan.alreadyImported&&<div aria-label="Checklist import review"><p className="ml-panel-description">Review: {plan.created} new actions, {plan.updated} updates and {plan.archived} recoverable archives. Recovery copies are kept for changed existing records.</p>{plan.preservedFields.length>0&&<p className="ml-form-help">Your edited titles, owners or deadlines will be retained on {plan.preservedFields.length} existing actions.</p>}<button className="ml-primary" disabled={busy||offline} onClick={()=>void apply()}>{busy?'Applying…':'Apply reviewed checklist'}<ArrowRight size={17}/></button></div>}
  {!plan&&!current&&<button className="ml-primary" disabled={busy||offline||!source} onClick={()=>void review()}>{busy?'Reviewing…':'Review checklist import'}<ArrowRight size={17}/></button>}
  {current&&<p className="ml-form-help">The current source version is recorded in Firestore. Repeating the import does not duplicate actions.</p>}
 </section>;
}
