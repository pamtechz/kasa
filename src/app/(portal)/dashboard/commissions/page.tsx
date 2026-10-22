'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Banknote,Clock,CheckCircle2,ExternalLink,X,Save} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {hasCapability} from '@/lib/access-policy';
import type {Role} from '@/lib/types';

type Commission={
 submissionId:string;reference:string;agentId:string;trigger:string;
 amount:number;currency:string;paidAt:string|null;paymentReference:string|null;
 fundingEvidence:string|null
};
type Totals={eligible:number;paid:number;pending:number};

export default function Commissions(){
 const [userRole,setUserRole]=useState<Role|null>(null);
 const canSettle=hasCapability(userRole,'commissions.settle');
 const canConfigure=hasCapability(userRole,'settings.manage');
 const [items,setItems]=useState<Commission[]>([]);
 const [totals,setTotals]=useState<Totals>({eligible:0,paid:0,pending:0});
 const [filter,setFilter]=useState('all');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [editing,setEditing]=useState<Commission|null>(null);
 const [paymentReference,setPaymentReference]=useState('');

 async function load(){
  try{
   const data=await api<{commissions:Commission[];totals:Totals}>('/api/admin/commissions');
   setItems(data.commissions);
   setTotals(data.totals);
  }catch(err){setError(err instanceof Error?err.message:'Unable to load commissions.');}
 }
 useEffect(()=>{void load();void api<{profile:{role:Role}}>('/api/me').then(x=>setUserRole(x.profile.role)).catch(()=>setUserRole(null));},[]);

 const visible=items.filter(x=>filter==='all'||(filter==='paid'?!!x.paidAt:!x.paidAt));
 async function recordPayout(event:React.FormEvent){
  event.preventDefault();
  if(!canSettle||!editing||!paymentReference.trim())return;
  setBusy(true);setError('');setNotice('');
  try{
   await api('/api/admin/commissions',{
    method:'PATCH',
    body:JSON.stringify({
     submissionId:editing.submissionId,
     paymentReference:paymentReference.trim(),
     amount:editing.amount,paid:true
    })
   });
   setNotice('The verified commission payout was recorded in the application ledger.');
   setEditing(null);setPaymentReference('');
   await load();
  }catch(err){setError(err instanceof Error?err.message:'Commission payout could not be recorded.');}
  finally{setBusy(false);}
 }
 return <>
  <PageHeader title="Commissions and referrals"
   subtitle="Commissions are created only after independently verified tuition payment or CDF approval."
   action={canConfigure?<Link href="/dashboard/settings" className="btn btn-outline">Configure rates <ExternalLink size={16}/></Link>:undefined}/>
  {error&&<div className="alert-error" role="alert">{error}</div>}
  {notice&&<div className="notice" role="status">{notice}</div>}
  <div className="metric-grid">
   <div className="metric-card"><div className="metric-icon blue"><Banknote/></div><span>Eligible</span><strong>K{totals.eligible.toFixed(2)}</strong></div>
   <div className="metric-card"><div className="metric-icon green"><CheckCircle2/></div><span>Paid</span><strong>K{totals.paid.toFixed(2)}</strong></div>
   <div className="metric-card"><div className="metric-icon amber"><Clock/></div><span>Awaiting payment</span><strong>K{totals.pending.toFixed(2)}</strong></div>
  </div>
  <div className="panel">
   <div className="panel-title" style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
    <div><h2>Verified commission ledger</h2><p>Approved amounts cannot be edited or manually assigned. Payments require a verified transfer reference.</p></div>
    <select className="form-select" aria-label="Filter commissions" value={filter} onChange={e=>setFilter(e.target.value)}>
     <option value="all">All</option><option value="pending">Pending</option><option value="paid">Paid</option>
    </select>
   </div>
   <div className="table-scroll"><table className="data-table">
    <thead><tr><th>Application</th><th>Agent ID</th><th>Eligibility</th><th>Amount</th><th>Status</th><th>Evidence</th><th>Action</th></tr></thead>
    <tbody>{visible.map(item=><tr key={item.submissionId}>
     <td><strong>{item.reference}</strong></td><td><small>{item.agentId}</small></td>
     <td>{item.trigger==='payment'?'Tuition payment':'CDF approval'}</td>
     <td>K{item.amount.toFixed(2)}</td>
     <td><span className={'tag '+(item.paidAt?'tag-green':'tag-amber')}>{item.paidAt?'Paid':'Pending'}</span></td>
     <td>{canSettle?(item.paymentReference||item.fundingEvidence||'—'):'—'}</td>
     <td>{item.paidAt||!canSettle?<span className="muted">{item.paidAt?'Recorded':'Awaiting approval'}</span>:<button className="text-link" onClick={()=>{setEditing(item);setPaymentReference('');}}>Record verified payout</button>}</td>
    </tr>)}{visible.length===0&&<tr><td colSpan={7} className="empty-state">No verified commissions match this filter.</td></tr>}</tbody>
   </table></div>
  </div>
  {canSettle&&editing&&<div className="modal-page-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null);}}>
   <div className="modal-page" style={{maxWidth:600}} role="dialog" aria-modal="true" aria-label="Record verified commission payout">
    <div className="modal-page-header">
     <div className="modal-page-header-left"><span className="modal-page-badge">VERIFIED PAYOUT</span><h2>Record commission payout</h2></div>
     <button className="icon-btn" aria-label="Close" onClick={()=>setEditing(null)}><X size={20}/></button>
    </div>
    <form onSubmit={e=>void recordPayout(e)} style={{display:'flex',flexDirection:'column',flex:1}}>
     <div className="modal-page-body"><div className="modal-page-card">
      <p className="muted">Application: <strong>{editing.reference}</strong></p>
      <p className="muted">Approved commission: <strong>K{editing.amount.toFixed(2)}</strong></p>
      <div className="field full"><label htmlFor="payout-reference">Verified bank or mobile money transfer reference *</label>
       <input id="payout-reference" required minLength={5} value={paymentReference} onChange={e=>setPaymentReference(e.target.value)} placeholder="Enter verified transaction reference"/>
      </div>
     </div></div>
     <div className="modal-page-footer"><button type="button" className="btn btn-outline" onClick={()=>setEditing(null)}>Cancel</button>
      <button type="submit" className="btn btn-primary" disabled={busy||paymentReference.trim().length<5}><Save size={16}/>{busy?'Saving…':'Record payout'}</button>
     </div>
    </form>
   </div>
  </div>}
 </>;
}
