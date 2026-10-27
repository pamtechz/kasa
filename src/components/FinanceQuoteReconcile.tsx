'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api} from '@/components/Portal';

type Tariff={id:string;programmeId:string;packageId:string;version:string;total:number;approvalReference:string;effectiveDate:string};
type Student={id:string;reference:string;studentName:string;programme:string;status:string;paidAmount:number};
export function FinanceQuoteReconcile({item,onClose,onSaved}:{item:Student;onClose:()=>void;onSaved:()=>Promise<void>}){
 const [tariffs,setTariffs]=useState<Tariff[]>([]);
 const [tariffId,setTariffId]=useState('');
 const [evidence,setEvidence]=useState('');
 const [agreement,setAgreement]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;void api<{tariffs:Tariff[]}>('/api/admin/fee-tariffs')
  .then(r=>{if(live)setTariffs(r.tariffs||[]);})
  .catch(e=>{if(live)setError(e instanceof Error?e.message:'Could not retrieve approved tariffs.');});
  return ()=>{live=false;};},[]);
 const selected=tariffs.find(t=>t.id===tariffId);
 const agreementRequired=['letter_issued','payment_verified','cdf_submitted','cdf_approved','commission_paid'].includes(item.status);
 async function submit(event:React.FormEvent){
  event.preventDefault();
  if(!confirmed||!selected)return;
  setBusy(true);setError('');
  try{
   await api('/api/admin/fee-quotes',{method:'POST',body:JSON.stringify({
    submissionId:item.id,tariffId,reconciliationEvidence:evidence,
    agreementReference:agreement,confirmedProgrammeAndPackage:confirmed
   })});
   await onSaved();onClose();
  }catch(e){setError(e instanceof Error?e.message:'Quote reconciliation failed.');}
  finally{setBusy(false);}
 }
 return <div className="editor-page-layout">
  <section className="modal-page editor-page-surface" aria-label="Reconcile approved student fee quotation" style={{maxWidth:900}}>
   <header className="modal-page-header"><div className="modal-page-header-left">
    <span className="modal-page-badge">CONTROLLED HISTORICAL RECONCILIATION</span>
    <h2>Approve fee snapshot — {item.reference}</h2>
   </div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button></header>
   <form onSubmit={e=>void submit(e)} style={{display:'flex',flexDirection:'column',minHeight:0,flex:1}}>
    <div className="modal-page-body">
     <p>Student: <b>{item.studentName}</b>. Application pathway: <b>{item.programme}</b>.
      Recorded receipts: ZMW {item.paidAmount.toFixed(2)}. These values will not be modified.</p>
     {error&&<div className="alert-error" role="alert">{error}</div>}
     <div className="field"><label htmlFor="reconcile-tariff">Previously approved programme and package</label>
      <select required id="reconcile-tariff" value={tariffId} onChange={e=>setTariffId(e.target.value)}>
       <option value="">Select approved tariff</option>
       {tariffs.map(t=><option key={t.id} value={t.id}>{t.programmeId} / {t.packageId} · {t.version} · ZMW {t.total.toFixed(2)}</option>)}
      </select>
     </div>
     {selected&&<p className="field-hint">Approval reference: {selected.approvalReference}. Effective: {selected.effectiveDate}. This approved version cannot be edited.</p>}
     {tariffs.length===0&&<p className="field-hint">No approved tariffs are registered. The super administrator must record the formally approved rates first. <Link href="/dashboard/finance/tariffs">Open tariff registry</Link>.</p>}
     <div className="field"><label htmlFor="reconcile-evidence">Source / documentary evidence reference *</label>
      <input id="reconcile-evidence" required minLength={8} maxLength={240} value={evidence} onChange={e=>setEvidence(e.target.value)}
       placeholder="Existing signed fee schedule, invoice or approval document reference"/>
     </div>
     {agreementRequired&&<div className="field"><label htmlFor="reconcile-agreement">Original acceptance letter / funding agreement reference *</label>
      <input id="reconcile-agreement" required minLength={8} maxLength={240} value={agreement} onChange={e=>setAgreement(e.target.value)}
       placeholder="Document identifier supporting the existing contract"/>
     </div>}
     <label style={{display:'flex',alignItems:'flex-start',gap:10,marginTop:12}}>
      <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
      <span>I have verified the applicant&apos;s actual course, package, effective tariff and original documentation. I understand this creates a permanent, non-overwritable fee snapshot.</span>
     </label>
    </div>
    <footer className="modal-page-footer">
     <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
     <button type="submit" className="btn btn-primary" disabled={busy||!selected||!confirmed||evidence.trim().length<8||(agreementRequired&&agreement.trim().length<8)}>
      {busy?'Saving…':'Save verified quote'}
     </button>
    </footer>
   </form>
  </section>
 </div>;
}
