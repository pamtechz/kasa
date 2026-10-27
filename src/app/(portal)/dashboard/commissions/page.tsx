'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Banknote,Clock,CheckCircle2,ExternalLink} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {can} from '@/lib/permissions';
import type {Role} from '@/lib/types';

type Commission={
 submissionId:string;reference:string;agentId:string;trigger:string;
 amount:number;currency:string;paidAt:string|null;paymentReference:string|null;
 fundingEvidence:string|null
};
type Totals={eligible:number;paid:number;pending:number};

export default function Commissions(){
 const [role,setRole]=useState<Role|null>(null);
 const [items,setItems]=useState<Commission[]>([]);
 const [totals,setTotals]=useState<Totals>({eligible:0,paid:0,pending:0});
 const [filter,setFilter]=useState('all');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');

 async function load(){
  try{
   const data=await api<{commissions:Commission[];totals:Totals}>('/api/admin/commissions');
   setItems(data.commissions);
   setTotals(data.totals);
  }catch(err){setError(err instanceof Error?err.message:'Unable to load commissions.');}
 }
 useEffect(()=>{void load();void api<{profile:{role:Role}}>('/api/me').then(x=>setRole(x.profile.role)).catch(()=>setRole(null));},[]);

 const visible=items.filter(x=>filter==='all'||(filter==='paid'?!!x.paidAt:!x.paidAt));

 return <>
  <PageHeader title="Commissions and referrals"
   subtitle="Commissions are created only after independently verified tuition payment or CDF approval."
   action={can(role,'settings.manage')?<Link href="/dashboard/settings" className="btn btn-outline">Configure rates <ExternalLink size={16}/></Link>:undefined}/>
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
     <td>{item.paymentReference||item.fundingEvidence||'—'}</td>
     <td>{item.paidAt?<span className="muted">Recorded</span>:!can(role,'commissions.manage')?<span className="muted">Read only</span>:<Link className="text-link" href={'/dashboard/commissions/'+encodeURIComponent(item.submissionId)+'/payout'}>Record verified payout</Link>}</td>
    </tr>)}{visible.length===0&&<tr><td colSpan={7} className="empty-state">No verified commissions match this filter.</td></tr>}</tbody>
   </table></div>
  </div>

 </>;
}
