'use client';
import {useEffect,useState} from 'react';
import {Save,Plus,Trash2,CalendarClock,ShieldCheck} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {initialIntake,type IntakePolicy} from '@/lib/intake-policy';
type FormBrief={slug:string;title:string;published:boolean};
function localDate(iso:string|null){
 if(!iso)return '';
 const d=new Date(iso);const n=new Date(d.getTime()-d.getTimezoneOffset()*60000);
 return n.toISOString().slice(0,16);
}
function convert(value:string){return value?new Date(value).toISOString():null;}
export default function Intake(){
 const [policy,setPolicy]=useState<IntakePolicy>(initialIntake),[forms,setForms]=useState<FormBrief[]>([]);
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  Promise.all([api<{policy:IntakePolicy}>('/api/admin/intake'),api<{forms:FormBrief[]}>('/api/admin/forms')])
   .then(([x,f])=>{setPolicy(x.policy);setForms(f.forms);}).catch(e=>setError(e.message));
 },[]);
 function update<K extends keyof IntakePolicy>(key:K,value:IntakePolicy[K]){setPolicy(p=>({...p,[key]:value}));}
 async function save(){
  setBusy(true);setError('');setMessage('');
  try{
   await api('/api/admin/intake',{method:'PUT',body:JSON.stringify(policy)});
   setMessage('Admission controls saved to Firestore. Public forms will follow this policy immediately.');
  }catch(e){setError(e instanceof Error?e.message:'Save failed.');}finally{setBusy(false);}
 }
 return <><PageHeader title="Application windows" subtitle="Open, pause and schedule admissions entirely from Firestore—not build variables."/>
 <div className="settings-grid"><section className="panel pad-panel">
 <h2><CalendarClock size={20}/> Enrollment controls</h2>
 <label className="required-toggle"><input type="checkbox" checked={policy.applicationsOpen} onChange={e=>update('applicationsOpen',e.target.checked)}/>Allow public applications (subject to published forms and dates)</label>
 <div className="form-grid">
  <div className="field"><label>Opening date and time (optional)</label><input type="datetime-local" value={localDate(policy.opensAt)} onChange={e=>update('opensAt',convert(e.target.value))}/></div>
  <div className="field"><label>Closing date and time (optional)</label><input type="datetime-local" value={localDate(policy.closesAt)} onChange={e=>update('closesAt',convert(e.target.value))}/></div>
 </div><div className="field"><label>Message shown when closed</label><textarea rows={3} value={policy.notice} onChange={e=>update('notice',e.target.value)}/></div>
 <h2>Individual forms</h2><p className="muted">Draft/unpublished forms are always closed. The global application switch must be enabled before any published form can open.</p>
 {forms.map(f=><label key={f.slug} className="required-toggle"><input type="checkbox" checked={policy.formOverrides[f.slug]!==false} onChange={e=>update('formOverrides',{...policy.formOverrides,[f.slug]:e.target.checked})}/>{f.title} <small>({f.published?'published':'draft'})</small></label>)}
 <h2>CDF sponsorship documents</h2><p className="muted">Set the documents KASA must have on file before verifying official CDF sponsorship. Requirements can differ by constituency; these are configurable institutional checks, not a claim about universal government requirements.</p>
 {policy.cdfRequiredDocuments.map((d,i)=><div className="admin-edit-item" key={i}><div className="form-grid">
  <div className="field"><label>Document code</label><input value={d.id} onChange={e=>update('cdfRequiredDocuments',policy.cdfRequiredDocuments.map((x,j)=>i===j?{...x,id:e.target.value}:x))}/></div>
  <div className="field"><label>Document name</label><input value={d.label} onChange={e=>update('cdfRequiredDocuments',policy.cdfRequiredDocuments.map((x,j)=>i===j?{...x,label:e.target.value}:x))}/></div></div>
  <button className="text-link" onClick={()=>update('cdfRequiredDocuments',policy.cdfRequiredDocuments.filter((_,j)=>i!==j))}><Trash2 size={15}/>Remove</button></div>)}
 <button className="btn btn-outline" onClick={()=>update('cdfRequiredDocuments',[...policy.cdfRequiredDocuments,{id:'new-document',label:'Additional required document'}])} disabled={policy.cdfRequiredDocuments.length>=20}><Plus size={16}/>Add document</button>
 <div className="section-pad-sm">{error&&<p className="alert-error">{error}</p>}{message&&<p className="notice">{message}</p>}
 <button className="btn btn-primary" onClick={()=>void save()} disabled={busy}><Save size={16}/>{busy?'Saving…':'Save admission policy'}</button></div>
 </section><aside className="panel pad-panel"><ShieldCheck size={32}/><h3>Fail-closed by default</h3><p>New deployments, unpublished forms and unconfigured policies never start accepting applications automatically. Staff can sign in and prepare KASA while enrollment is closed.</p><p>Closing admission immediately blocks new submissions, including requests started before closure. In-progress records remain available to authorized staff.</p></aside></div></>;
}
