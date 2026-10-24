'use client';
import {useEffect,useRef} from 'react';
import {X,RefreshCcw,Trash2} from 'lucide-react';
import type {PendingEdit} from '@/lib/marathon-offline';
import type {MarathonTask} from '@/lib/marathon-types';
import {categoryForSection,isMarathonCategorySection} from '@/lib/marathon-categories';

const labels:Record<string,string>={title:'Title',lead:'Responsible team',section:'Category',dueDate:'Due date',priority:'Priority',importance:'Importance',status:'Status',completedAt:'Completed at',nextStep:'Next action',notes:'Notes',evidence:'Evidence',archived:'Archived'};
function display(value:unknown,key?:string){
 if(key==='section'&&isMarathonCategorySection(value))return categoryForSection(value).label;
 if(value===null||value===undefined||value==='')return 'Not set';
 if(value===true)return 'Yes';if(value===false)return 'No';
 return String(value);
}
export function MarathonSyncReview({edit,current,error,busy,onClose,onResolve}:{
 edit:PendingEdit;current:MarathonTask|null;error:string;busy:boolean;onClose:()=>void;onResolve:(retry:boolean)=>void;
}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const node=dialog.current;node?.showModal();
  return ()=>node?.close();
 },[]);
 return <dialog ref={dialog} className="ml-sync-dialog" aria-labelledby="ml-sync-review-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <header><div><span className="ml-eyebrow">SAVED EDIT · {edit.taskId}</span><h2 id="ml-sync-review-title">Review your changes</h2></div><button className="ml-secondary" aria-label="Close comparison" onClick={onClose}><X size={20}/></button></header>
  <div className="ml-sync-dialog-content">
   <p>Compare the changes saved on this device with the current online action. Applying your changes checks that the online version has not changed again.</p>
   {error&&<p className="ml-warning ml-notice" role="alert">{error}</p>}
   {!current&&!error&&<p role="status">Loading the current online action…</p>}
   <div className="ml-sync-comparison"><table><caption>Changes to {edit.taskId}</caption><thead><tr><th scope="col">Field</th><th scope="col">Online record</th><th scope="col">Your device edit</th></tr></thead><tbody>{Object.entries(edit.changes).map(([key,value])=><tr key={key}><th scope="row">{labels[key]||key}</th><td>{current?display(current[key as keyof MarathonTask],key):'Unavailable'}</td><td>{display(value,key)}</td></tr>)}</tbody></table></div>
   {edit.submitted&&<p className="ml-form-help">An earlier request is awaiting confirmation. Sync it before discarding or replacing this edit.</p>}
  </div>
  <footer><button className="ml-secondary" disabled={busy||!!edit.submitted} onClick={()=>onResolve(false)}><Trash2 size={16}/> Discard device edit</button><button className="ml-primary" disabled={busy||!current||!!edit.submitted} onClick={()=>onResolve(true)}><RefreshCcw size={16}/> Apply my changes</button></footer>
 </dialog>;
}
