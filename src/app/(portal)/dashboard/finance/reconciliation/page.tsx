'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api,PageHeader} from '@/components/Portal';
type Issue={id:string;level:'critical'|'review';message:string};
type Row={id:string;reference:string;student:string;status:string;fundingMethod:string;flags:Issue[];balanceMinor:number|null};
type Result={items:Row[];summary:{critical:number;totalItems:number;scanned:number;partial:boolean};note:string};
export default function FinanceReconciliation(){
 const [data,setData]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [filter,setFilter]=useState('all');
 async function refresh(){setBusy(true);setError('');
  try{setData(await api<Result>('/api/admin/finance/reconciliation'));}
  catch(e){setError(e instanceof Error?e.message:'Unable to load reconciliation.');}
  finally{setBusy(false);}
 }
 useEffect(()=>{void refresh();},[]);
 const rows=(data?.items||[]).filter(r=>filter==='all'||r.flags.some(f=>f.level===filter));
 return <><PageHeader title="Finance reconciliation queue"
   subtitle="Review unquoted fees, missing enrollment verification, CDF remittance and inconsistent payment records. Nothing is modified automatically."/>
  <p><Link href="/dashboard/finance" className="btn btn-outline">Back to finance ledger</Link></p>
  {error&&<p role="alert" className="alert-error">{error}</p>}
  {data&&<div className="metric-grid">
   <div className="metric-card"><span>Applications inspected</span><strong>{data.summary.scanned}</strong></div>
   <div className="metric-card"><span>Requires attention</span><strong>{data.summary.totalItems}</strong></div>
   <div className="metric-card"><span>Critical records</span><strong>{data.summary.critical}</strong></div>
  </div>}
  {data?.summary.partial&&<p className="notice">This scan reached the 10,000-application safety limit; totals are incomplete.</p>}
  <section className="panel"><div className="panel-title" style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
   <div><h2>Cases to review</h2><p>Read-only triage, ordered by severity</p></div>
   <select aria-label="Filter case priority" className="form-select" value={filter} onChange={e=>setFilter(e.target.value)}>
    <option value="all">All cases</option><option value="critical">Critical</option><option value="review">Needs review</option>
   </select>
   <button className="btn btn-outline" disabled={busy} onClick={()=>void refresh()}>{busy?'Refreshing…':'Refresh queue'}</button>
  </div>
  <div className="table-scroll"><table className="data-table">
   <thead><tr><th>Application</th><th>Student</th><th>Funding</th><th>Reason</th><th>Action</th></tr></thead>
   <tbody>{rows.map(row=><tr key={row.id}>
    <td><strong>{row.reference}</strong><small style={{display:'block'}}>{row.status}</small></td>
    <td>{row.student}</td><td>{row.fundingMethod==='cdf'?'CDF':'Self-funded'}</td>
    <td>{row.flags.map(f=><p key={f.id} style={{margin:'2px 0'}}><strong>{f.level==='critical'?'Critical':'Review'}:</strong> {f.message}</p>)}</td>
    <td>{row.flags.some(f=>f.id==='missing_quote')?
     <Link className="btn btn-outline" href={'/dashboard/finance/'+encodeURIComponent(row.id)+'/reconcile'}>Reconcile quote</Link>:
     <Link className="btn btn-outline" href={'/dashboard/applications/'+encodeURIComponent(row.id)}>Review enrollment</Link>}
    </td>
   </tr>)}
    {!rows.length&&<tr><td colSpan={5}>{busy?'Scanning applications…':'No matching reconciliation cases.'}</td></tr>}
   </tbody></table></div></section>
  {data&&<p className="muted">{data.note} An item only leaves this queue when its underlying verified record is corrected through the existing authorized workflow.</p>}
 </>;
}
