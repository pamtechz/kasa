'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,Banknote,Save} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {can} from '@/lib/permissions';
import type {Role} from '@/lib/types';
type Commission={submissionId:string;reference:string;agentId:string;amount:number;paidAt:string|null;paymentReference:string|null;fundingEvidence:string|null};
export default function RecordCommissionPayout(){
 const {id}=useParams<{id:string}>();
 const [item,setItem]=useState<Commission|null>(null),[role,setRole]=useState<Role|null>(null);
 const [reference,setReference]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;void Promise.all([
  api<{commissions:Commission[]}>('/api/admin/commissions'),
  api<{profile:{role:Role}}>('/api/me')
 ]).then(([data,me])=>{if(!active)return;
  setItem(data.commissions.find(x=>x.submissionId===id)||null);setRole(me.profile.role);
 }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load commission.');})
 .finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[id]);
 async function submit(event:React.FormEvent){
  event.preventDefault();if(!item||!can(role,'commissions.manage')||item.paidAt||reference.trim().length<5)return;
  setBusy(true);setError('');setMessage('');
  try{
   await api('/api/admin/commissions',{method:'PATCH',body:JSON.stringify({
    submissionId:item.submissionId,paymentReference:reference.trim(),amount:item.amount,paid:true
   })});setMessage('Verified commission payout recorded.');setItem({...item,paidAt:new Date().toISOString(),paymentReference:reference.trim()});
  }catch(e){setError(e instanceof Error?e.message:'Payout could not be recorded.');}
  finally{setBusy(false);}
 }
 return <>
  <PageHeader title="Record verified commission payout" subtitle="Dedicated payout entry page. Approved commission amounts remain immutable."/>
  <p><Link className="btn btn-outline" href="/dashboard/commissions"><ArrowLeft size={16}/> Back to commissions</Link></p>
  {loading&&<p role="status">Loading commission…</p>}
  {error&&<div className="alert-error" role="alert">{error}</div>}
  {message&&<div className="notice" role="status">{message}</div>}
  {!loading&&!item&&<div className="notice">No eligible commission record found.</div>}
  {item&&<section className="panel pad-panel" style={{maxWidth:850}}>
   <h2><Banknote size={20}/> {item.reference}</h2>
   <p>Agent: {item.agentId}</p><p>Approved amount: <strong>ZMW {item.amount.toFixed(2)}</strong></p>
   <p>Original approval evidence: {item.fundingEvidence||'Check application ledger'}</p>
   {item.paidAt?<p className="notice">Already recorded: {item.paymentReference}</p>:
    !can(role,'commissions.manage')?<p className="alert-error">Your account has read-only commission access.</p>:
   <form onSubmit={e=>void submit(e)}><div className="field">
    <label htmlFor="commission-payment-ref">Independently verified bank/mobile transfer reference *</label>
    <input id="commission-payment-ref" required minLength={5} maxLength={160} value={reference} onChange={e=>setReference(e.target.value)}/>
   </div>
   <p className="muted">Only record a real payment. This operation is audited and cannot mint a new commission.</p>
   <button type="submit" className="btn btn-primary" disabled={busy||reference.trim().length<5}><Save size={16}/>{busy?'Recording…':'Record payout'}</button>
   </form>}
  </section>}
 </>;
}
