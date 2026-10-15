'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Banknote,Clock,CheckCircle2,ExternalLink} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
type Commission={submissionId:string;reference:string;agentId:string;trigger:string;amount:number;currency:string;paidAt:string|null;paymentReference:string|null;fundingEvidence:string|null};
type Totals={eligible:number;paid:number;pending:number};
export default function Commissions(){
 const [items,setItems]=useState<Commission[]>([]),[totals,setTotals]=useState<Totals>({eligible:0,paid:0,pending:0}),[error,setError]=useState(''),[filter,setFilter]=useState('all');
 useEffect(()=>{api<{commissions:Commission[];totals:Totals}>('/api/admin/commissions').then(r=>{setItems(r.commissions);setTotals(r.totals);}).catch(e=>setError(e.message));},[]);
 const filtered=items.filter(x=>filter==='all'||(filter==='paid'?Boolean(x.paidAt):!x.paidAt));
 return <><PageHeader title="Commissions and referrals" subtitle="Control awards for independently verified CDF approvals or paid student enrollments." action={<Link href="/dashboard/settings" className="btn btn-outline">Configure rates <ExternalLink size={16}/></Link>}/>
 {error&&<div className="alert-error">{error}</div>}
 <div className="metric-grid"><div className="metric-card"><div className="metric-icon blue"><Banknote/></div><span>Eligible</span><strong>K{totals.eligible.toFixed(2)}</strong></div><div className="metric-card"><div className="metric-icon green"><CheckCircle2/></div><span>Paid</span><strong>K{totals.paid.toFixed(2)}</strong></div><div className="metric-card"><div className="metric-icon amber"><Clock/></div><span>Awaiting payment</span><strong>K{totals.pending.toFixed(2)}</strong></div></div>
 <div className="panel"><div className="panel-title"><div><h2>Agent commission ledger</h2><p>Payment references are recorded by KASA administrators in Applications. No automatic disbursements take place.</p></div>
 <select className="form-select" value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter commissions"><option value="all">All</option><option value="pending">Pending</option><option value="paid">Paid</option></select></div>
 <div className="table-scroll"><table className="data-table"><thead><tr><th>Application</th><th>Agent ID</th><th>Eligibility</th><th>Amount</th><th>Status</th><th>Evidence</th></tr></thead><tbody>{filtered.map(x=><tr key={x.submissionId}><td><strong>{x.reference}</strong></td><td><small>{x.agentId}</small></td><td>{x.trigger==='payment'?'Tuition payment':'CDF approval'}</td><td>K{x.amount.toFixed(2)}</td><td>{x.paidAt?'Paid':'Awaiting transfer'}</td><td>{x.paymentReference||x.fundingEvidence||'—'}</td></tr>)}{!filtered.length&&<tr><td colSpan={6} className="empty-state">No eligible commissions found.</td></tr>}</tbody></table></div></div></>;
}
