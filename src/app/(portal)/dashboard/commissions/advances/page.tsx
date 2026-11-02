'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api,PageHeader} from '@/components/Portal';
type Row={submissionId:string;reference:string;student:string;recipientUid:string;paidMinor:number;feeMinor:number;limitMinor:number;advanceMinor:number;advanceTransactionId:string|null;fundingStatus:string};
type Payload={rows:Row[];commissionRateMinor:number;partial:boolean;note:string};
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
  if(!window.confirm('Record this independently transferred commission advance? It will reduce any later final commission.'))return;
  setSaving(true);
  try{
   const result=await api<{message:string}>('/api/admin/commissions/advance',{method:'POST',body:JSON.stringify({
    submissionId:selected.submissionId,amount:Number(amount),transactionId:reference,reason,referralVerified:true
   })});
   setNotice(result.message);setChosen('');await load();
  }catch(e){setError(e instanceof Error?e.message:'Unable to record advance.');}
  finally{setSaving(false);}
 }
 return <>
  <PageHeader title="Early referral commission advances" subtitle="Administrator-only payments backed by a verified partial tuition installment. These advances are not yet earned commissions."/>
  <p><Link className="btn btn-outline" href="/dashboard/commissions">Back to commission ledger</Link></p>
  {error&&<div className="alert-error" role="alert">{error}</div>}
  {notice&&<div className="notice" role="status">{notice}</div>}
  <section className="panel pad-panel">
   <h2>Safe advance rules</h2>
   <p>Finance must first record the student's real tuition installment. Only an administrator can record an early referral payout. The amount may not exceed the referral commission multiplied by the proportion of programme fees received. An advance reduces the later commission and cannot be recorded twice for the same enrollment.</p>
   <p><strong>Current self-funded commission rate:</strong> {cash(data?.commissionRateMinor||0)}. CDF approvals do not qualify; government remittance follows its separate verification route.</p>
   {data?.partial&&<p className="notice">The application scan reached its limit and may omit some older applications.</p>}
   <div className="table-scroll"><table className="data-table">
    <thead><tr><th>Student</th><th>Tuition received</th><th>Advance limit</th><th>Previous advance</th><th>Action</th></tr></thead>
    <tbody>{(data?.rows||[]).map(row=><tr key={row.submissionId}>
      <td><strong>{row.reference}</strong><small style={{display:'block'}}>{row.student}</small></td>
      <td>{cash(row.paidMinor)} / {cash(row.feeMinor)}</td><td>{cash(row.limitMinor)}</td>
      <td>{row.advanceMinor>0?cash(row.advanceMinor)+' · '+row.advanceTransactionId:'—'}</td>
      <td>{row.limitMinor>0&&!row.advanceMinor?
       <button className="btn btn-outline" type="button" onClick={()=>edit(row)}>Record early advance</button>:
       <span className="muted">{row.advanceMinor?'Already recorded':'Not eligible for advance'}</span>}</td>
    </tr>)}
    {!data?.rows.length&&<tr><td colSpan={5}>No partially paid referred students currently eligible for advance review.</td></tr>}
    </tbody></table></div>
  </section>
  {selected&&<section className="panel pad-panel" style={{maxWidth:820,marginTop:20}}>
   <h2>Record transfer for {selected.student} ({selected.reference})</h2>
   <p><strong>Maximum permitted:</strong> {cash(selected.limitMinor)}. The actual transfer must already be independently verified. Recording here does not send money.</p>
   <form onSubmit={e=>void record(e)}>
    <div className="field"><label htmlFor="advance-amount">Advance transferred (K)</label>
     <input id="advance-amount" required type="number" inputMode="decimal" min="0.01" max={selected.limitMinor/100} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
    <div className="field"><label htmlFor="advance-reference">Independent bank/mobile-money transaction ID</label>
     <input id="advance-reference" required minLength={5} maxLength={160} value={reference} onChange={e=>setReference(e.target.value)}/></div>
    <div className="field"><label htmlFor="advance-reason">Reason and supporting evidence</label>
     <textarea id="advance-reason" required minLength={15} maxLength={600} value={reason} onChange={e=>setReason(e.target.value)} rows={3}/></div>
    <label className="required-toggle"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
      I verified the student payment, referrer identity and independent evidence that this exact advance was transferred.</label>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
     <button type="submit" className="btn btn-primary" disabled={saving||!confirmed||!amount||Number(amount)<=0||Number(amount)*100>selected.limitMinor||reference.trim().length<5||reason.trim().length<15}>{saving?'Recording…':'Record advance and issue recipient proof'}</button>
     <button type="button" className="btn btn-outline" onClick={()=>setChosen('')}>Cancel</button>
    </div>
   </form>
  </section>}
 </>;
}
