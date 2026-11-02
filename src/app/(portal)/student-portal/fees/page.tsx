'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {StudentPortal} from '@/components/StudentPortal';
import {authHeaders} from '@/lib/firebase-client';
type App={id:string;reference:string;formTitle:string};
type Statement={application:{id:string;reference:string;programme:string;fundingMethod:string;status:string};
 summary:{quotedFeeMinor:number|null;recordedTuitionMinor:number|null;cdfReceivedMinor:number|null;balanceMinor:number|null;
 enrolledAndFunded:boolean;receiptTotalMinor:number|null;needsReconciliation:boolean;quoteUnavailable:boolean};
 receipts:{id:string;amountMinor:number;totalPaidMinor:number;transactionId:string;paymentMethod:string;recordedAt:string}[];
 partial:boolean};
const money=(n:number|null)=>n===null?'Needs reconciliation':'K'+(n/100).toLocaleString('en-ZM',{minimumFractionDigits:2,maximumFractionDigits:2});
export default function StudentFeeStatement(){
 const [apps,setApps]=useState<App[]>([]),[chosen,setChosen]=useState(''),[statement,setStatement]=useState<Statement|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  void (async()=>{try{
   const headers=await authHeaders(),res=await fetch('/api/student/applications',{headers,cache:'no-store'});
   const d=await res.json();if(!res.ok)throw Error(d.error||'Unable to load applications.');
   if(!active)return;
   const list=(d.applications||[]) as App[];setApps(list);if(list.length)setChosen(list[0].id);
  }catch(e){if(active)setError(e instanceof Error?e.message:'Unable to load applications.');}
  finally{if(active)setLoading(false);}})();
  return()=>{active=false;};
 },[]);
 useEffect(()=>{
  if(!chosen)return;
  let active=true;setBusy(true);setError('');setStatement(null);
  void (async()=>{try{
   const headers=await authHeaders();
   const response=await fetch('/api/student/fee-statements?applicationId='+encodeURIComponent(chosen),{headers,cache:'no-store'});
   const body=await response.json();
   if(!response.ok)throw Error(body.error||'Statement could not be loaded.');
   if(active)setStatement(body as Statement);
  }catch(e){if(active)setError(e instanceof Error?e.message:'Unable to load statement.');}
  finally{if(active)setBusy(false);}})();
  return()=>{active=false;};
 },[chosen]);
 async function download(id:string){
  try{
   const headers=await authHeaders(),res=await fetch('/api/tuition-receipts/'+encodeURIComponent(id)+'/pdf',{headers,cache:'no-store'});
   if(!res.ok)throw Error('Receipt PDF could not be downloaded.');
   const url=URL.createObjectURL(await res.blob()),link=document.createElement('a');
   link.href=url;link.download='KASA-Tuition-Receipt-'+id.slice(0,12)+'.pdf';document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),5000);
  }catch(e){setError(e instanceof Error?e.message:'Download failed.');}
 }
 return <StudentPortal>
  <div className="page-heading"><div><h1>My fee statement</h1><p>Approved programme fees, independently recorded payments, receipts and outstanding balance.</p></div>
  <Link href="/student-portal/applications" className="btn btn-outline">Applications</Link></div>
  {error&&<div className="alert-error" role="alert">{error}</div>}
  {loading?<p role="status">Loading student applications…</p>:!apps.length?
   <section className="panel pad-panel">No applications are linked to this account. Link your application securely in Applications &amp; Documents.</section>:
   <section className="panel pad-panel"><div className="field"><label htmlFor="fee-app">Student application</label>
    <select id="fee-app" className="form-select" value={chosen} onChange={e=>setChosen(e.target.value)}>
     {apps.map(a=><option key={a.id} value={a.id}>{a.reference} — {a.formTitle}</option>)}
    </select></div>
    {busy&&<p role="status">Calculating your statement…</p>}
    {statement&&<><p><strong>{statement.application.programme}</strong> · {statement.application.fundingMethod==='cdf'?'CDF sponsored':'Self-funded'} · {statement.application.status.replace(/_/g,' ')}</p>
     <div className="metric-grid">
      <div className="metric-card"><span>Approved fees</span><strong>{money(statement.summary.quotedFeeMinor)}</strong></div>
      <div className="metric-card"><span>Tuition recorded</span><strong>{money(statement.summary.recordedTuitionMinor)}</strong></div>
      <div className="metric-card"><span>Verified CDF remittance</span><strong>{money(statement.summary.cdfReceivedMinor)}</strong></div>
      <div className="metric-card"><span>Balance to reconcile</span><strong>{money(statement.summary.balanceMinor)}</strong></div>
     </div>
     {statement.summary.quoteUnavailable&&<p className="notice">Your approved fee quote has not yet been reconciled. No amount due is assumed until finance approves it.</p>}
     {statement.summary.needsReconciliation&&<p className="notice">Your digital receipt totals differ from the recorded ledger or need review. This can include historic payments. Ask KASA Finance for reconciliation; no payments have been erased.</p>}
     {statement.partial&&<p className="notice">More than 100 receipts exist; request a complete statement from Finance.</p>}
     <p><strong>Funding and enrollment:</strong> {statement.summary.enrolledAndFunded?'Full funding and enrollment verified': 'Pending independent full-funding and enrollment verification'}</p>
     <h2>Recorded installment receipts</h2><div className="table-scroll"><table className="data-table">
      <thead><tr><th>Date</th><th>Amount</th><th>Paid to date</th><th>Transaction ID</th><th>Receipt</th></tr></thead>
      <tbody>{statement.receipts.map(r=><tr key={r.id}><td>{r.recordedAt.slice(0,10)}</td><td>{money(r.amountMinor)}</td><td>{money(r.totalPaidMinor)}</td><td>{r.transactionId}</td>
       <td><button className="btn btn-outline" type="button" onClick={()=>void download(r.id)}>Download PDF</button></td></tr>)}
       {!statement.receipts.length&&<tr><td colSpan={5}>No digital receipts recorded for this application.</td></tr>}
      </tbody></table></div>
     <p className="muted">CDF approval does not mean money has been received. A receipt records a Finance entry, not independent bank settlement; retain the original bank/mobile-money confirmation.</p>
    </>}
   </section>}
 </StudentPortal>;
}
