'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {ArrowLeft,Save,MapPin} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
type Agent={uid:string;displayName:string;email:string;agentCode:string;district:string;province:string;constituency:string;ward:string;active:boolean};
export default function EditAgentPage(){
 const {uid}=useParams<{uid:string}>();
 const [agent,setAgent]=useState<Agent|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [district,setDistrict]=useState(''),[province,setProvince]=useState(''),[constituency,setConstituency]=useState(''),[ward,setWard]=useState(''),[active,setActive]=useState(true);
 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const res=await api<{agent:Agent}>('/api/admin/agents/'+encodeURIComponent(uid));
   setAgent(res.agent);setDistrict(res.agent.district);setProvince(res.agent.province);
   setConstituency(res.agent.constituency);setWard(res.agent.ward);setActive(res.agent.active);
  }catch(e){setError(e instanceof Error?e.message:'Agent not found.');}
  finally{setLoading(false);}
 },[uid]);
 useEffect(()=>{void load();},[load]);
 async function save(event:React.FormEvent){
  event.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   await api('/api/admin/agents/'+encodeURIComponent(uid),{method:'PATCH',
    body:JSON.stringify({district,province,constituency,ward,active})});
   setMessage('Agent assignment saved.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Unable to save agent.');}
  finally{setBusy(false);}
 }
 return <>
  <PageHeader title="Edit district agent" subtitle="Full-page assignment management; changes are saved through the authorized server API."/>
  <p><Link className="btn btn-outline" href="/dashboard/agents"><ArrowLeft size={16}/> Back to agents</Link></p>
  {error&&<div className="alert-error" role="alert">{error}</div>}
  {message&&<div className="notice" role="status">{message}</div>}
  {loading&&<p role="status">Loading agent…</p>}
  {agent&&<section className="panel pad-panel" style={{maxWidth:900}}>
   <h2><MapPin size={19}/> {agent.displayName}</h2>
   <p className="muted">{agent.email} · Referral code: {agent.agentCode}</p>
   <form onSubmit={e=>void save(e)}>
    <div className="form-grid">
     <div className="field"><label htmlFor="agent-district">District *</label><input id="agent-district" required minLength={2} maxLength={120} value={district} onChange={e=>setDistrict(e.target.value)}/></div>
     <div className="field"><label htmlFor="agent-province">Province</label><input id="agent-province" maxLength={100} value={province} onChange={e=>setProvince(e.target.value)}/></div>
     <div className="field"><label htmlFor="agent-constituency">Constituency</label><input id="agent-constituency" maxLength={100} value={constituency} onChange={e=>setConstituency(e.target.value)}/></div>
     <div className="field"><label htmlFor="agent-ward">Ward</label><input id="agent-ward" maxLength={100} value={ward} onChange={e=>setWard(e.target.value)}/></div>
    </div>
    <label className="required-toggle"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Agent account active</label>
    <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:20}}>
     <Link className="btn btn-outline" href="/dashboard/agents">Cancel</Link>
     <button type="submit" className="btn btn-primary" disabled={busy||district.trim().length<2}><Save size={16}/>{busy?'Saving…':'Save agent details'}</button>
    </div>
   </form>
  </section>}
 </>;
}
