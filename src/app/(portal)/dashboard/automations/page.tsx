'use client';
import {useEffect,useState} from 'react';
import {Plus,Save,Trash2} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {automationEvents,defaultAutomations,type AutomationConfig} from '@/lib/automations';
export default function Automations(){
 const [config,setConfig]=useState<AutomationConfig>(defaultAutomations),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{api<{config:AutomationConfig}>('/api/admin/automations').then(r=>setConfig(r.config)).catch(e=>setError(e.message));},[]);
 const update=(index:number,field:string,value:unknown)=>setConfig(old=>({...old,rules:old.rules.map((r,i)=>i===index?{...r,[field]:value}:r)}));
 async function save(){setBusy(true);setError('');setNotice('');
  try{await api('/api/admin/automations',{method:'PUT',body:JSON.stringify(config)});setNotice('Automation rules saved.');}
  catch(e){setError(e instanceof Error?e.message:'Save failed.');}finally{setBusy(false);}
 }
 function add(){const id='rule-'+Date.now().toString(36);setConfig(x=>({...x,rules:[...x.rules,{id,name:'New internal notification',event:'accepted',enabled:false,recipient:'admin',template:'Application {{reference}} was updated.'}]}));}
 return <><PageHeader title="Automations" subtitle="Customize internal notification rules for student reviews, funding decisions and agent commissions."/>
 <div className="panel pad-panel"><div className="notice"><strong>Internal notifications only.</strong> These rules create auditable notifications in Firestore. They do not send email, WhatsApp, SMS or payments until a verified provider is connected and a delivery service is implemented.</div>
 {config.rules.map((rule,i)=><section className="admin-edit-item" key={rule.id}>
  <div className="inline-form"><h3>{rule.name}</h3><label className="required-toggle"><input type="checkbox" checked={rule.enabled} onChange={e=>update(i,'enabled',e.target.checked)}/>Enabled</label><button className="text-link" onClick={()=>setConfig(c=>({...c,rules:c.rules.filter(x=>x.id!==rule.id)}))}><Trash2 size={16}/>Remove</button></div>
  <div className="form-grid"><div className="field"><label>Rule name</label><input value={rule.name} onChange={e=>update(i,'name',e.target.value)}/></div>
  <div className="field"><label>When this happens</label><select value={rule.event} onChange={e=>update(i,'event',e.target.value)}>{automationEvents.map(event=><option value={event} key={event}>{event.replaceAll('_',' ')}</option>)}</select></div>
  <div className="field"><label>Who sees it</label><select value={rule.recipient} onChange={e=>update(i,'recipient',e.target.value)}><option value="admin">Administrators</option><option value="reviewer">Reviewers</option><option value="agent">Attributed agent</option></select></div></div>
  <div className="field"><label>Notification message (use {'{{reference}}'} for the application number)</label><textarea rows={3} value={rule.template} onChange={e=>update(i,'template',e.target.value)}/></div>
 </section>)}
 <div className="inline-form"><button className="btn btn-outline" onClick={add} disabled={config.rules.length>=30}><Plus size={16}/>Add rule</button><button className="btn btn-primary" disabled={busy} onClick={()=>void save()}><Save size={16}/>{busy?'Saving…':'Save automations'}</button></div>
 {error&&<div className="alert-error">{error}</div>}{notice&&<div className="notice">{notice}</div>}
 </div></>;
}
