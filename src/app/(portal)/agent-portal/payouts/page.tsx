import {CommissionReceiptCenter} from '@/components/CommissionReceiptCenter';
'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {AgentPortal} from '@/components/AgentPortal';
import {authHeaders} from '@/lib/firebase-client';

type Referral={id:string;reference:string;candidateName?:string;commission:{amount:number;currency:string;paidAt:string|null}|null};
type Payout={id:string;submissionId:string;amount:number;status:string;requestedAt:string;paymentMethod:string;paymentReference?:string;reason?:string};
const money=(amount:number)=>'K'+amount.toFixed(2);

export default function AgentPayouts(){
 const [referrals,setReferrals]=useState<Referral[]>([]);
 const [payouts,setPayouts]=useState<Payout[]>([]);
 const [submissionId,setSubmissionId]=useState('');
 const [method,setMethod]=useState('mtn'),[accountName,setAccountName]=useState(''),[accountNumber,setAccountNumber]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){
  const headers=await authHeaders();
  const [r,p]=await Promise.all([
   fetch('/api/agent/referrals',{headers,cache:'no-store'}),
   fetch('/api/agent/payout-request',{headers,cache:'no-store'})
  ]);
  if(!r.ok||!p.ok)throw Error('Could not load your verified commission records.');
  const [referralData,payoutData]=await Promise.all([r.json(),p.json()]);
  setReferrals(referralData.referrals||[]);
  setPayouts(payoutData.payouts||[]);
 }
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:'Unable to load payouts.'));},[]);
 const reserved=new Set(payouts.filter(p=>['pending','approved','settled'].includes(p.status)).map(p=>p.submissionId));
 const available=referrals.filter(x=>x.commission&&!x.commission.paidAt&&!reserved.has(x.id));
 async function requestPayout(event:React.FormEvent){
  event.preventDefault();setError('');setNotice('');setBusy(true);
  try{
   const headers=await authHeaders();
   const res=await fetch('/api/agent/payout-request',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({submissionId,paymentMethod:method,accountName,accountNumber})});
   const out=await res.json();
   if(!res.ok)throw Error(out.error||out.message||'Request not accepted.');
   setNotice('Request received. KASA must verify and approve it before any transfer.');
   setSubmissionId('');await load();
  }catch(e){setError(e instanceof Error?e.message:'Request failed.');}finally{setBusy(false);}
 }
 async function withdraw(id:string){
  if(!window.confirm('Withdraw this pending commission request?'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const headers=await authHeaders();
   const res=await fetch('/api/agent/payout-request',{method:'PATCH',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({id,action:'withdraw'})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Withdrawal failed.');
   setNotice('Request withdrawn.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Withdrawal failed.');}finally{setBusy(false);}
 }
 return <AgentPortal><div className="page-heading"><div><h1>Commission payout requests</h1>
  <p>Only fully funded, independently verified and unpaid enrollment commissions can be requested. A request does not move money.</p></div>
  <Link href="/agent-portal" className="btn btn-outline">Back to agent portal</Link></div>
  {error&&<div className="alert-error" role="alert">{error}</div>}
  {notice&&<div className="notice" role="status">{notice}</div>}
  <section className="panel pad-panel" style={{maxWidth:850}}><h2>Request a verified commission</h2>
   <form onSubmit={e=>void requestPayout(e)}>
    <div className="field"><label htmlFor="payout-commission">Eligible commission</label>
     <select className="form-select" id="payout-commission" required value={submissionId} onChange={e=>setSubmissionId(e.target.value)}>
      <option value="">Choose an unpaid verified enrollment</option>
      {available.map(r=><option key={r.id} value={r.id}>{r.reference} — {r.candidateName||'Student'} — {money(r.commission!.amount)}</option>)}
     </select>
    </div>
    <div className="field"><label htmlFor="payout-method">Transfer method</label>
     <select className="form-select" id="payout-method" value={method} onChange={e=>setMethod(e.target.value)}>
      <option value="mtn">MTN MoMo</option><option value="airtel">Airtel Money</option><option value="zamtel">Zamtel</option><option value="bank">Bank transfer</option>
     </select>
    </div>
    <div className="field"><label htmlFor="payout-account-name">Account holder name</label>
     <input id="payout-account-name" required maxLength={100} value={accountName} onChange={e=>setAccountName(e.target.value)}/>
    </div>
    <div className="field"><label htmlFor="payout-account">Mobile-money number or bank account</label>
     <input id="payout-account" required maxLength={50} value={accountNumber} onChange={e=>setAccountNumber(e.target.value)}/>
    </div>
    <button className="btn btn-primary" type="submit" disabled={busy||!submissionId||!accountName.trim()||!accountNumber.trim()}>
     {busy?'Submitting…':'Submit request for review'}
    </button>
   </form>
   {!available.length&&<p className="muted">No unreserved, verified and unpaid commissions are currently available.</p>}
  </section>
  <section className="panel" style={{marginTop:24}}><div className="panel-title"><h2>My requests</h2></div>
   <div className="table-scroll"><table className="data-table"><thead><tr><th>Requested</th><th>Commission</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>
    {payouts.map(p=><tr key={p.id}><td>{p.requestedAt?.slice(0,10)}</td><td>{referrals.find(r=>r.id===p.submissionId)?.reference||p.submissionId}</td>
     <td>{money(p.amount)}</td><td>{p.status}</td><td>{p.status==='pending'?
     <button className="btn btn-outline" disabled={busy} onClick={()=>void withdraw(p.id)}>Withdraw</button>:p.paymentReference||p.reason||'—'}</td></tr>)}
    {!payouts.length&&<tr><td colSpan={5}>No payout requests yet.</td></tr>}
   </tbody></table></div>
  </section>
  <CommissionReceiptCenter/>
 </AgentPortal>;
}
