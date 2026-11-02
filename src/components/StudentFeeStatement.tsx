'use client';
import {useState} from 'react';
import {authHeaders} from '@/lib/firebase-client';
type Item={id:string;recordedAt:string;amountMinor:number;totalPaidMinor:number;transactionId:string;paymentMethod:string};
type Flag={id:string;level:'critical'|'review';message:string};
type Statement={application:{reference:string;programme:string;status:string;fundingMethod:string};statement:{
 feeMinor:number|null;paidMinor:number|null;cdfReceivedMinor:number|null;balanceMinor:number|null;
 fullyEnrolled:boolean;receiptSumMinor:number|null;receiptHistoryPartial:boolean;flags:Flag[];receipts:Item[]}};
const money=(v:number|null)=>v===null?'Reconciliation needed':'K'+(v/100).toLocaleString('en-ZM',{minimumFractionDigits:2,maximumFractionDigits:2});
export function StudentFeeStatement({submissionId}:{submissionId:string}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [data,setData]=useState<Statement|null>(null),[error,setError]=useState('');
 async function load(){
  setBusy(true);setError('');
  try{
   const headers=await authHeaders();
   const response=await fetch('/api/student/applications/'+encodeURIComponent(submissionId)+'/statement',{headers,cache:'no-store'});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Could not load your statement.');
   setData(result);setOpen(true);
  }catch(e){setError(e instanceof Error?e.message:'Statement unavailable.');}
  finally{setBusy(false);}
 }
 return <section className="panel pad-panel" style={{marginTop:12}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
   <div><h3 style={{margin:'0 0 5px'}}>My fee statement</h3><small>Approved fees, paid installments, remaining balance and funding review</small></div>
   <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>open?setOpen(false):void load()}>{busy?'Loading…':open?'Hide statement':'View fee statement'}</button>
  </div>
  {error&&<p className="alert-error" role="alert">{error}</p>}
  {open&&data&&<div style={{marginTop:14}}>
   <div className="metric-grid">
    <div className="metric-card"><span>Approved programme fees</span><strong>{money(data.statement.feeMinor)}</strong></div>
    <div className="metric-card"><span>Recorded student payments</span><strong>{money(data.statement.paidMinor)}</strong></div>
    <div className="metric-card"><span>CDF received and verified</span><strong>{money(data.statement.cdfReceivedMinor)}</strong></div>
    <div className="metric-card"><span>Outstanding balance</span><strong>{money(data.statement.balanceMinor)}</strong></div>
   </div>
   {data.statement.receiptHistoryPartial&&<p className="notice">The receipt history reached its display limit. Request a full statement from Finance.</p>}
   {data.statement.flags.map(flag=><p key={flag.id} className={flag.level==='critical'?'alert-error':'notice'}>{flag.message}. Contact Finance for reconciliation.</p>)}
   <p><strong>Enrollment verification:</strong> {data.statement.fullyEnrolled?'Verified and fully funded':'Not yet independently verified'}</p>
   <div className="table-scroll"><table className="data-table"><thead><tr><th>Recorded</th><th>Paid</th><th>Running paid</th><th>Payment reference</th></tr></thead>
    <tbody>{data.statement.receipts.map(item=><tr key={item.id}>
     <td>{item.recordedAt.slice(0,10)}</td><td>{money(item.amountMinor)}</td><td>{money(item.totalPaidMinor)}</td><td>{item.transactionId}</td>
    </tr>)}
    {!data.statement.receipts.length&&<tr><td colSpan={4}>No digital installment receipts found. Older payments may need reconciliation.</td></tr>}
    </tbody></table></div>
   <p className="muted">This statement uses verified school records. It does not approve an application or trigger commission by itself. Download individual payment receipts from the section below.</p>
  </div>}
 </section>;
}
