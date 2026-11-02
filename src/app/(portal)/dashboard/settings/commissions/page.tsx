'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api,PageHeader} from '@/components/Portal';
import {ShieldCheck,Wallet,ArrowLeft} from 'lucide-react';

type Policy={commissionAmountPaid:number;commissionAmountCdf:number;referralsEnabled:boolean;updatedAt:string|null};
const amount=(n:number)=>'K'+n.toLocaleString('en-ZM',{minimumFractionDigits:2,maximumFractionDigits:2});
export default function CommissionSettings(){
 const [selfFunded,setSelfFunded]=useState('0'),[cdf,setCdf]=useState('0');
 const [enabled,setEnabled]=useState(true),[saved,setSaved]=useState<Policy|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{api<{settings:Policy}>('/api/admin/settings/commissions')
   .then(({settings})=>{setSaved(settings);setSelfFunded(String(settings.commissionAmountPaid));
      setCdf(String(settings.commissionAmountCdf));setEnabled(settings.referralsEnabled);})
   .catch(e=>setError(e instanceof Error?e.message:'Could not load settings.'))
   .finally(()=>setLoading(false));},[]);
 const valid=(value:string)=>value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=50000&&
  Math.abs(Number(value)*100-Math.round(Number(value)*100))<.000001;
 async function save(e:React.FormEvent){
  e.preventDefault();setError('');setNotice('');
  if(!valid(selfFunded)||!valid(cdf)){setError('Enter a valid amount from K0 to K50,000, using at most two decimal places.');return;}
  setBusy(true);
  try{
   const policy={commissionAmountPaid:Number(selfFunded),commissionAmountCdf:Number(cdf),referralsEnabled:enabled};
   const result=await api<{message:string}>('/api/admin/settings/commissions',{method:'PATCH',body:JSON.stringify(policy)});
   setSaved({...policy,updatedAt:new Date().toISOString()});setNotice(result.message);
  }catch(e){setError(e instanceof Error?e.message:'Unable to save commission policy.');}
  finally{setBusy(false);}
 }
 return <>
  <PageHeader title="Commission settings" subtitle="Set one amount for each funding route. No percentages, hidden bonuses or automatic transfers."/>
  <p><Link className="btn btn-outline" href="/dashboard/settings"><ArrowLeft size={16}/> Back to general settings</Link></p>
  {error&&<div className="alert-error" role="alert">{error}</div>}
  {notice&&<div className="notice" role="status">{notice}</div>}
  <div className="settings-grid">
   <section className="panel pad-panel">
    <h2><Wallet size={20}/> Referral commission rates</h2>
    <p className="muted">These are fixed Zambian-kwacha amounts paid once per successfully funded and verified student enrollment.</p>
    <form onSubmit={e=>void save(e)}>
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
     <label className="required-toggle"><input type="checkbox" checked={enabled} disabled={loading||busy}
      onChange={e=>setEnabled(e.target.checked)}/> Accept new referrals</label>
     <p className="muted">Turning this off stops new referral links from being accepted. Previously verified earnings remain payable.</p>
     <button type="submit" className="btn btn-primary" disabled={loading||busy||!valid(selfFunded)||!valid(cdf)}>
      {busy?'Saving…':'Save commission rates'}
     </button>
    </form>
   </section>
   <aside className="panel pad-panel">
    <ShieldCheck size={24}/>
    <h3>What the settings mean</h3>
    <p><strong>Self-funded:</strong> {valid(selfFunded)?amount(Number(selfFunded)):'Enter a rate'} per verified student.</p>
    <p><strong>CDF-funded:</strong> {valid(cdf)?amount(Number(cdf)):'Enter a rate'} per verified student.</p>
    <p><strong>Referrals:</strong> {enabled?'New referrals enabled':'New referrals paused'}.</p>
    <p>Rates apply to <strong>future</strong> qualifying enrollments. Existing approved commission amounts and payout records are not changed.</p>
    <p>Zero means no new commission for that route. Commissions are not additional student fees.</p>
    <p>Finance must verify each payment separately. The recipient must confirm the recorded amount and transaction ID; a bank transfer cannot be proven by a recipient checkbox alone.</p>
    {saved?.updatedAt&&<p className="muted">Last policy update: {new Date(saved.updatedAt).toLocaleString('en-ZM')}</p>}
    <Link href="/dashboard/commissions" className="text-link">View commission ledger</Link>
   </aside>
  </div>
 </>;
}