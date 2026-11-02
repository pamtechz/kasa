'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api,PageHeader} from '@/components/Portal';
type Row={submissionId:string;reference:string;student:string;recipientUid:string;paidMinor:number;feeMinor:number;limitMinor:number;advanceMinor:number;advanceTransactionId:string|null;fundingStatus:string;mode:'progressive'|'full_on_first_payment'|'after_full_enrollment'};
type Payload={rows:Row[];commissionRateMinor:number;commissionPercent:number;rateType:'fixed'|'percentage';mode:string;partial:boolean;note:string};
const cash=(minor:number)=>'K'+(minor/100).toLocaleString('en-ZM',{minimumFractionDigits:2,maximumFractionDigits:2});
export default function CommissionAdvancesPage(){
 const [data,setData]=useState<Payload|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [chosen,setChosen]=useState<string>(''),[amount,setAmount]=useState(''),[reference,setReference]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[saving,setSaving]=useState(false);
 async function load(){
  const result=await api<Payload>('/api/admin/commissions/advance');
  setData(result);
 }
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:'Unable to load eligible records.'));},[]);
 const selected=data?.rows.find(x=>x.submissionId===chosen);
 function edit(row:Row){setChosen(row.submissionId);setAmount('');setReference('');setReason('');setConfirmed(false);setError('');setNotice('');}
 async function record(e:React.FormEvent){
  e.preventDefault();setError('');setNotice('');
  if(!selected||!confirmed){setError('Choose a student and confirm referral and bank evidence.');return;}
  if(!window.confirm('Record this independently transferred commission advance? The system will cap cumulative payouts and deduct them from the final commission.'))return;
  setSaving(true);
  try{
   const result=await api<{message:string}>('/api/admin/commissions/advance',{method:'POST',body:JSON.stringify({
    submissionId:selected.submissionId,amount:Number(amount),transactionId:reference,reason,referralVerified:true,paymentVerified:true
   })});
   setNotice(result.message);setChosen('');await load();
  }catch(e){setError(e instanceof Error?e.message:'Unable to record advance.');}
  finally{setSaving(false);}
 }
 return <>
  <PageHeader title="Verified referral commission payouts" subtitle="Progressive, full-on-first-payment, or deferred payouts follow the admin-selected policy. Every actual transfer requires a unique proof and recipient acknowledgement."/>
  <p><Link className="btn btn-outline" href="/dashboard/commissions">Back to commission ledger</Link></p>
  {error&&<div className="alert-error" role="alert">{error}</div>}
  {notice&&<div className="notice" role="status">{notice}</div>}
  <section className="panel pad-panel">
   <h2>Controlled commission payouts</h2>
   <p>Finance must first record a real tuition installment with matching evidence. Admin verifies the active referrer, confirms the actual bank/mobile-money transfer, then records its amount and unique transaction ID. Progressive mode limits total transfers to the proportion earned on verified payments. Full-on-first-payment is an explicitly higher-risk exception. The full commission is never paid twice.</p>
   <p><strong>Current self-funded rate:</strong> {data?.rateType==='percentage'?data.commissionPercent+'% of approved programme fees':cash(data?.commissionRateMinor||0)}. <strong>Timing:</strong> {data?.mode==='progressive'?'Proportional to received tuition':data?.mode==='full_on_first_payment'?'Full payout after first verified payment':'Wait for fully funded enrollment'}.</p>
   {data?.mode==='full_on_first_payment'&&<p className="alert-error">High financial risk: full payout may precede completion of fees. Any subsequent refund or default requires documented recovery/reconciliation.</p>}
   <p>CDF government approval notices do not qualify; bank remittance and enrollment follow separate controls. Changes to policy do not alter advances already recorded.</p>
   {data?.partial&&<p className="notice">The application scan reached its limit and may omit some older applications.</p>}
   <div className="table-scroll"><table className="data-table">
    <thead><tr><th>Student</th><th>Tuition received</th><th>Cumulative eligible payout</th><th>Previously transferred</th><th>Action</th></tr></thead>
    <tbody>{(data?.rows||[]).map(row=><tr key={row.submissionId}>
      <td><strong>{row.reference}</strong><small style={{display:'block'}}>{row.student}</small></td>
      <td>{cash(row.paidMinor)} / {cash(row.feeMinor)}</td><td>{cash(row.limitMinor)} <small style={{display:'block'}}>Available: {cash(Math.max(0,row.limitMinor-row.advanceMinor))}</small></td>
      <td>{row.advanceMinor>0?cash(row.advanceMinor)+' · '+row.advanceTransactionId:'—'}</td>
      <td>{row.limitMinor>row.advanceMinor?
       <button className="btn btn-outline" type="button" onClick={()=>edit(row)}>Record verified payout</button>:
       <span className="muted">{row.limitMinor<=row.advanceMinor&&row.advanceMinor?'Paid to current limit':'Not eligible under selected policy'}</span>}</td>
    </tr>)}
    {!data?.rows.length&&<tr><td colSpan={5}>No partially paid referred students currently eligible for advance review.</td></tr>}
    </tbody></table></div>
  </section>
  {selected&&<section className="panel pad-panel" style={{maxWidth:820,marginTop:20}}>
   <h2>Record transfer for {selected.student} ({selected.reference})</h2>
   <p><strong>Remaining payable now:</strong> {cash(Math.max(0,selected.limitMinor-selected.advanceMinor))}. The actual transfer must already be independently verified. Recording here does not send money.</p>
   <form onSubmit={e=>void record(e)}>
    <div className="field"><label htmlFor="advance-amount">Advance transferred (K)</label>
     <input id="advance-amount" required type="number" inputMode="decimal" min="0.01" max={Math.max(0,selected.limitMinor-selected.advanceMinor)/100} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
    <div className="field"><label htmlFor="advance-reference">Independent bank/mobile-money transaction ID</label>
     <input id="advance-reference" required minLength={5} maxLength={160} value={reference} onChange={e=>setReference(e.target.value)}/></div>
    <div className="field"><label htmlFor="advance-reason">Reason and supporting evidence</label>
     <textarea id="advance-reason" required minLength={15} maxLength={600} value={reason} onChange={e=>setReason(e.target.value)} rows={3}/></div>
    <label className="required-toggle"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
      I verified the student payment, referrer identity and independent evidence that this exact advance was transferred.</label>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
     <button type="submit" className="btn btn-primary" disabled={saving||!confirmed||!amount||Number(amount)<=0||Number(amount)*100>selected.limitMinor-selected.advanceMinor||reference.trim().length<5||reason.trim().length<15}>{saving?'Recording…':'Record payout and issue recipient receipt'}</button>
     <button type="button" className="btn btn-outline" onClick={()=>setChosen('')}>Cancel</button>
    </div>
   </form>
  </section>}
 </>;
}
