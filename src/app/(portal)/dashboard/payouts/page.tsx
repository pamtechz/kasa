'use client';
import {CommissionReceiptCenter} from '@/components/CommissionReceiptCenter';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api,PageHeader} from '@/components/Portal';

type Payout={id:string;submissionId:string;agentUid:string;agentName:string;amount:number;currency:string;
 status:string;paymentMethod:string;accountName:string;accountNumber:string;requestedAt:string;reason?:string;paymentReference?:string};
export default function ReviewPayoutRequests(){
 const [rows,setRows]=useState<Payout[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const data=await api<{payouts:Payout[]}>('/api/agent/payout-request');setRows((data.payouts||[]).sort((a,b)=>b.requestedAt.localeCompare(a.requestedAt)));}
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:'Unable to load requests.'));},[]);
 async function decide(row:Payout,action:'approve'|'reject'){
  const reason=action==='reject'?window.prompt('Reason for rejecting this payout request (minimum eight characters):'):null;
  if(action==='reject'&&(reason===null||reason.trim().length<8))return;
  setBusy(true);setError('');setNotice('');
  try{
   await api('/api/agent/payout-request',{method:'PATCH',body:JSON.stringify({id:row.id,action,reason})});
   setNotice(action==='approve'?'Request approved. After independently transferring funds, record the verified payment reference in Commissions.':'Request rejected; its commission reservation was released.');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Request update failed.');}
  finally{setBusy(false);}
 }
 return <>
  <PageHeader title="Agent payout requests" subtitle="Approve verified requests, then separately record actual transfers against the canonical commission ledger."/>
  {error&&<div className="alert-error" role="alert">{error}</div>}
  {notice&&<div className="notice" role="status">{notice}</div>}
  <section className="panel"><div className="table-scroll"><table className="data-table">
   <thead><tr><th>Date</th><th>Agent</th><th>Amount</th><th>Destination</th><th>Status</th><th>Action</th></tr></thead>
   <tbody>{rows.map(p=><tr key={p.id}>
    <td>{p.requestedAt?.slice(0,10)}</td><td>{p.agentName||p.agentUid}<small> · {p.submissionId}</small></td>
    <td>K{p.amount.toFixed(2)}</td><td>{p.paymentMethod?.toUpperCase()} · {p.accountName} · {p.accountNumber}</td>
    <td>{p.status}</td><td>
     {p.status==='pending'&&<button className="btn btn-outline" disabled={busy} onClick={()=>void decide(p,'approve')}>Approve request</button>}
     {['pending','approved'].includes(p.status)&&<button className="btn btn-outline" disabled={busy} onClick={()=>void decide(p,'reject')}>Reject</button>}
     {p.status==='approved'&&<Link href={'/dashboard/commissions/'+encodeURIComponent(p.submissionId)+'/payout'} className="text-link">Record verified transfer</Link>}
     {p.status==='settled'&&<span>{p.paymentReference||'Settled'}</span>}
    </td>
   </tr>)}
   {!rows.length&&<tr><td colSpan={6}>No payout requests have been submitted.</td></tr>}
   </tbody></table></div></section>
  <CommissionReceiptCenter admin/>
  <p className="muted">Approving a request does not initiate a bank or mobile-money transfer. Transfers require independent proof before recording settlement.</p>
 </>;
}
