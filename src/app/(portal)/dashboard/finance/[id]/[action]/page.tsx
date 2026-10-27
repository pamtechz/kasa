'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams,useRouter} from 'next/navigation';
import {ArrowLeft,Wallet,DollarSign,ShieldCheck} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {FinanceQuoteReconcile} from '@/components/FinanceQuoteReconcile';
import {can} from '@/lib/permissions';
import type {Role} from '@/lib/types';

type LedgerItem={
 id:string;reference:string;studentName:string;programme:string;fundingMethod:string;
 status:string;totalPackage:number|null;feeStatus:'approved'|'requires_reconciliation';
 paidAmount:number;outstandingBalance:number|null;
};
export default function FinanceActionPage(){
 const params=useParams<{id:string;action:string}>(),router=useRouter();
 const [item,setItem]=useState<LedgerItem|null>(null);
 const [role,setRole]=useState<Role|null>(null);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [amount,setAmount]=useState(''),[method,setMethod]=useState('Bank Deposit');
 const [reference,setReference]=useState(''),[note,setNote]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const [ledger,me]=await Promise.all([
    api<{ledger:LedgerItem[]}>('/api/admin/finance'),
    api<{profile:{role:Role}}>('/api/me')
   ]);
   setRole(me.profile.role);
   const selected=ledger.ledger.find(x=>x.id===params.id);
   if(!selected)throw Error('This application was not found in the current financial ledger.');
   setItem(selected);
  }catch(e){setError(e instanceof Error?e.message:'Unable to open financial record.');}
  finally{setLoading(false);}
 },[params.id]);
 useEffect(()=>{void load();},[load]);
 async function record(event:React.FormEvent){
  event.preventDefault();
  if(!item||!can(role,'finance.record')||item.fundingMethod==='cdf'||item.totalPackage===null)return;
  const n=Number(amount);
  if(!Number.isFinite(n)||n<=0||n>(item.outstandingBalance||0))return;
  setBusy(true);setError('');setMessage('');
  try{
   const result=await api<{message:string}>('/api/admin/finance',{method:'POST',body:JSON.stringify({
    submissionId:item.id,amountPaid:n,paymentMethod:method,receiptReference:reference,note
   })});
   setMessage(result.message);setAmount('');setReference('');setNote('');await load();
  }catch(e){setError(e instanceof Error?e.message:'Receipt could not be recorded.');}
  finally{setBusy(false);}
 }
 const money=(n:number)=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 const authorized=can(role,'finance.record');
 const reconcile=params.action==='reconcile',receipt=params.action==='receipt';
 const eligible=Boolean(item&&item.totalPackage!==null&&item.outstandingBalance!==null&&item.outstandingBalance>0&&item.fundingMethod!=='cdf');
 return <>
  <PageHeader title={reconcile?'Reconcile approved fees':'Record tuition receipt'} subtitle="Dedicated financial record editor; receipt recording and enrollment approval remain separate."/>
  <p><Link className="btn btn-outline" href="/dashboard/finance"><ArrowLeft size={16}/> Back to financial ledger</Link></p>
  {loading&&<p role="status">Loading verified financial record…</p>}
  {error&&<div className="alert-error" role="alert">{error}</div>}
  {message&&<div className="notice" role="status">{message}</div>}
  {item&&!authorized&&<div className="alert-error">This account can view finance records but cannot edit them.</div>}
  {item&&authorized&&reconcile&&item.feeStatus==='requires_reconciliation'&&
   <FinanceQuoteReconcile item={item} onClose={()=>router.push('/dashboard/finance')}
    onSaved={async()=>{await load();}}/>}
  {item&&authorized&&reconcile&&item.feeStatus==='approved'&&
   <section className="panel pad-panel"><ShieldCheck size={22}/><p>This application already has an immutable approved fee quotation.</p></section>}
  {item&&authorized&&receipt&&<section className="panel pad-panel" style={{maxWidth:900}}>
   <h2><DollarSign size={19}/> {item.studentName} — {item.reference}</h2>
   <p>Programme: {item.programme}</p>
   <p>Approved package: {item.totalPackage===null?'Reconciliation required':'ZMW '+money(item.totalPackage)} · Recorded paid: ZMW {money(item.paidAmount)}</p>
   <p>Outstanding: {item.outstandingBalance===null?'Not confirmed':'ZMW '+money(item.outstandingBalance)}</p>
   {!eligible?<p className="alert-error" role="alert">A new receipt cannot be recorded for an unquoted, settled or CDF-sponsored application.</p>:
   <form onSubmit={e=>void record(e)}>
    <div className="form-grid">
     <div className="field"><label htmlFor="receipt-amount">Verified payment amount (ZMW) *</label>
      <input id="receipt-amount" required type="number" min="0.01" step="0.01" max={item.outstandingBalance||undefined} value={amount} onChange={e=>setAmount(e.target.value)}/></div>
     <div className="field"><label htmlFor="receipt-method">Payment method</label>
      <select id="receipt-method" value={method} onChange={e=>setMethod(e.target.value)}>
       <option>Bank Deposit</option><option>Bank Transfer</option><option>MTN Mobile Money</option>
       <option>Airtel Money</option><option>Zamtel Kwacha</option><option>Cash Receipt</option>
      </select></div>
     <div className="field full"><label htmlFor="receipt-ref">Bank / receipt reference *</label>
      <input id="receipt-ref" required minLength={4} value={reference} onChange={e=>setReference(e.target.value)}/></div>
     <div className="field full"><label htmlFor="receipt-note">Evidence notes (optional)</label>
      <textarea id="receipt-note" maxLength={500} rows={3} value={note} onChange={e=>setNote(e.target.value)}/></div>
    </div>
    <p className="muted">Amounts must be independently verified. Saving a receipt does not approve enrollment, change CDF status or trigger agent commission.</p>
    <button className="btn btn-primary" type="submit" disabled={busy||!amount||reference.trim().length<4}>
     <Wallet size={17}/>{busy?'Recording…':'Record verified receipt'}
    </button>
   </form>}
  </section>}
  {item&&!receipt&&!reconcile&&<div className="alert-error">Unknown finance operation.</div>}
 </>;
}
