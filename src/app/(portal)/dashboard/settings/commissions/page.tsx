'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api,PageHeader} from '@/components/Portal';
import {ShieldCheck,Wallet,ArrowLeft} from 'lucide-react';

type Mode='progressive'|'full_on_first_payment'|'after_full_enrollment';
type RateType='fixed'|'percentage';
type Policy={commissionAmountPaid:number;commissionAmountCdf:number;referralsEnabled:boolean;updatedAt:string|null;
 commissionPaymentMode:Mode;commissionRateType:RateType;commissionPercentage:number};
const amount=(n:number)=>'K'+n.toLocaleString('en-ZM',{minimumFractionDigits:2,maximumFractionDigits:2});
export default function CommissionSettings(){
 const [selfFunded,setSelfFunded]=useState('0'),[cdf,setCdf]=useState('0');
 const [enabled,setEnabled]=useState(true),[saved,setSaved]=useState<Policy|null>(null);
 const [mode,setMode]=useState<Mode>('after_full_enrollment'),[rateType,setRateType]=useState<RateType>('fixed'),[percent,setPercent]=useState('0');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{api<{settings:Policy}>('/api/admin/settings/commissions')
   .then(({settings})=>{setSaved(settings);setSelfFunded(String(settings.commissionAmountPaid));
      setCdf(String(settings.commissionAmountCdf));setEnabled(settings.referralsEnabled);
      setMode(settings.commissionPaymentMode);setRateType(settings.commissionRateType);
      setPercent(String(settings.commissionPercentage));})
   .catch(e=>setError(e instanceof Error?e.message:'Could not load settings.'))
   .finally(()=>setLoading(false));},[]);
 const valid=(value:string)=>value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=50000&&
  Math.abs(Number(value)*100-Math.round(Number(value)*100))<.000001;
 async function save(e:React.FormEvent){
  e.preventDefault();setError('');setNotice('');
  if(!valid(selfFunded)||!valid(cdf)||!valid(percent)||Number(percent)>100){setError('Use valid amounts and a percentage from 0 to 100.');return;}
  setBusy(true);
  try{
   const policy={commissionAmountPaid:Number(selfFunded),commissionAmountCdf:Number(cdf),referralsEnabled:enabled,
    commissionPaymentMode:mode,commissionRateType:rateType,commissionPercentage:Number(percent)};
   const result=await api<{message:string}>('/api/admin/settings/commissions',{method:'PATCH',body:JSON.stringify(policy)});
   setSaved({...policy,updatedAt:new Date().toISOString()});setNotice(result.message);
  }catch(e){setError(e instanceof Error?e.message:'Unable to save commission policy.');}
  finally{setBusy(false);}
 }
 return <>
  <PageHeader title="Commission settings" subtitle="Choose when the referrer gets paid, whether commission uses a percentage or fixed amount, and keep each transfer verified."/>
  <p><Link className="btn btn-outline" href="/dashboard/settings"><ArrowLeft size={16}/> Back to general settings</Link></p>
  {error&&<div className="alert-error" role="alert">{error}</div>}
  {notice&&<div className="notice" role="status">{notice}</div>}
  <div className="settings-grid">
   <section className="panel pad-panel">
    <h2><Wallet size={20}/> Referral commission rates</h2>
    <p className="muted">Self-funded referrals may earn commission as verified installments arrive. For CDF-funded students, actual government remittance and enrollment verification remain mandatory.</p>
    <form onSubmit={e=>void save(e)}>
     <div className="field"><label htmlFor="commission-timing">1. When should commission be payable?</label>
      <select id="commission-timing" className="form-select" value={mode} disabled={loading||busy} onChange={e=>setMode(e.target.value as Mode)}>
       <option value="progressive">Recommended — as verified student payments arrive (proportionally)</option>
       <option value="full_on_first_payment">Full commission after the first verified payment (higher financial risk)</option>
       <option value="after_full_enrollment">Wait until all fees are paid and enrollment is verified</option>
      </select>
      <small>Finance records actual student payments; Admin verifies the referrer and independently confirmed transfer. No automatic mobile-money payment.</small>
     </div>
     <div className="field"><label htmlFor="commission-rate-type">2. How is the commission calculated?</label>
      <select id="commission-rate-type" className="form-select" value={rateType} disabled={loading||busy} onChange={e=>setRateType(e.target.value as RateType)}>
       <option value="percentage">Percentage of approved programme fees</option>
       <option value="fixed">Fixed kwacha amount per referred enrollment</option>
      </select>
     </div>
     {rateType==='percentage'&&<div className="field"><label htmlFor="commission-percent">Commission rate (%)</label>
      <input id="commission-percent" type="number" inputMode="decimal" min="0.01" max="100" step="0.01"
       value={percent} required onChange={e=>setPercent(e.target.value)} disabled={loading||busy}/>
      <small>Example: with a 10% rate, K2,000 verified tuition yields K200 in progressive commission. The total commission cannot exceed 10% of the approved programme fees.</small>
     </div>}
     {rateType==='fixed'&&<>
     <div className="field"><label htmlFor="self-funded-rate">1. Self-funded student — commission per verified enrollment (K)</label>
      <input id="self-funded-rate" type="number" inputMode="decimal" min="0" max="50000" step="0.01"
       required disabled={loading||busy} value={selfFunded} onChange={e=>setSelfFunded(e.target.value)}/>
      <small>Earned only after the full approved tuition is received and enrollment is independently verified.</small>
     </div>
     <div className="field"><label htmlFor="cdf-funded-rate">2. CDF-funded student — commission per verified enrollment (K)</label>
      <input id="cdf-funded-rate" type="number" inputMode="decimal" min="0" max="50000" step="0.01"
       required disabled={loading||busy} value={cdf} onChange={e=>setCdf(e.target.value)}/>
      <small>Earned only after government funds actually reach KASA, required documents are verified, and enrollment is confirmed. A CDF approval letter alone does not qualify.</small>
     </div>
     </>}
     <label className="required-toggle"><input type="checkbox" checked={enabled} disabled={loading||busy}
      onChange={e=>setEnabled(e.target.checked)}/> Accept new referrals</label>
     <p className="muted">Turning this off stops new referral links from being accepted. Previously verified earnings remain payable.</p>
     <button type="submit" className="btn btn-primary" disabled={loading||busy||!valid(selfFunded)||!valid(cdf)||!valid(percent)||Number(percent)>100||(rateType==='percentage'&&Number(percent)===0)}>
      {busy?'Saving…':'Save commission rates'}
     </button>
    </form>
   </section>
   <aside className="panel pad-panel">
    <ShieldCheck size={24}/>
    <h3>What the settings mean</h3>
    <p><strong>Self-funded:</strong> {rateType==='percentage'?percent+'% of approved fees':valid(selfFunded)?amount(Number(selfFunded)):'Enter a rate'} per verified enrollment.</p>
    <p><strong>Payout timing:</strong> {mode==='progressive'?'Proportional to verified receipts':mode==='full_on_first_payment'?'Full advance after first verified receipt':'Only after fully paid enrollment'}.</p>
    {mode==='full_on_first_payment'&&<p className="alert-error">Higher risk: the full commission can be advanced before the student finishes paying. If the student defaults or requests a refund, Finance must reconcile or recover the advance. This option needs explicit Admin approval for every transfer.</p>}
    <p><strong>CDF-funded:</strong> {valid(cdf)?amount(Number(cdf)):'Enter a rate'} per verified student.</p>
    <p><strong>Referrals:</strong> {enabled?'New referrals enabled':'New referrals paused'}.</p>
    <p>Changes apply to new payout-policy snapshots. Once a referred enrollment has an advance, its commission amount and payment mode are locked to the original policy for accurate settlement.</p>
    <p>Zero fixed rate means no new fixed commission for that route. Commissions are not additional student fees.</p>
    <p>Finance must verify each payment separately. The recipient must confirm the recorded amount and transaction ID; a bank transfer cannot be proven by a recipient checkbox alone.</p>
    {saved?.updatedAt&&<p className="muted">Last policy update: {new Date(saved.updatedAt).toLocaleString('en-ZM')}</p>}
    <Link href="/dashboard/commissions" className="text-link">View commission ledger</Link>
   </aside>
  </div>
 </>;
}