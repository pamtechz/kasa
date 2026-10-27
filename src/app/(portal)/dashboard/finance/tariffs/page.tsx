'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api,PageHeader} from '@/components/Portal';
import type {Role} from '@/lib/types';
type Tariff={id:string;programmeId:string;packageId:string;version:string;approvalReference:string;approvedAt:string;approvedBy:string;effectiveDate:string;total:number;tuition:number;practical:number;administration:number;accommodation:number;food:number};
const fields=['tuition','practical','administration','accommodation','food'] as const;
type MoneyField=typeof fields[number];
export default function FinanceTariffRegistry(){
 const [role,setRole]=useState<Role|null>(null);
 const [tariffs,setTariffs]=useState<Tariff[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [programmeId,setProgrammeId]=useState(''),[packageId,setPackageId]=useState(''),[version,setVersion]=useState('');
 const [approvalReference,setApprovalReference]=useState(''),[effectiveDate,setEffectiveDate]=useState('');
 const [confirmedApproval,setConfirmedApproval]=useState(false);
 const [amounts,setAmounts]=useState<Record<MoneyField,string>>({tuition:'',practical:'',administration:'',accommodation:'',food:''});
 const total=fields.reduce((sum,key)=>sum+Math.round(Number(amounts[key]||0)*100),0)/100;
 async function load(){
  setLoading(true);
  try{const res=await api<{tariffs:Tariff[]}>('/api/admin/fee-tariffs');setTariffs(res.tariffs||[]);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Could not load tariff registry.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();void api<{profile:{role:Role}}>('/api/me').then(r=>setRole(r.profile.role)).catch(()=>setRole(null));},[]);
 async function submit(event:React.FormEvent){
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   await api('/api/admin/fee-tariffs',{method:'POST',body:JSON.stringify({
    programmeId,packageId,version,approvalReference,effectiveDate,confirmedApproval,
    ...Object.fromEntries(fields.map(k=>[k,Number(amounts[k])]))
   })});
   setNotice('The approved version is permanently registered. Existing applications must be individually reconciled.');
   setConfirmedApproval(false);setVersion('');setApprovalReference('');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Could not register approved tariff.');}
  finally{setBusy(false);}
 }
 return <>
  <PageHeader title="Approved Fee Tariff Registry" subtitle="Controlled, versioned KASA School tuition and package tariffs. No automatic guessed prices." />
  <p><Link href="/dashboard/finance">Return to finance ledger</Link></p>
  {error&&<div className="alert-error" role="alert">{error}</div>}
  {notice&&<div className="notice" role="status">{notice}</div>}
  {role==='super_admin'&&<section className="panel" style={{padding:22,marginBottom:22}}>
   <h2>Register a formally approved tariff</h2>
   <p>Use only an authorized finance approval. The tariff cannot subsequently be edited or replaced. A new decision requires a new version.</p>
   <form onSubmit={e=>void submit(e)}>
    <div className="form-grid">
     <div className="field"><label>Programme identifier *</label><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="e.g. general-agriculture" value={programmeId} onChange={e=>setProgrammeId(e.target.value)}/></div>
     <div className="field"><label>Package identifier *</label><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="e.g. day-scholar" value={packageId} onChange={e=>setPackageId(e.target.value)}/></div>
     <div className="field"><label>Tariff version *</label><input required placeholder="e.g. 2027-v1" value={version} onChange={e=>setVersion(e.target.value)}/></div>
     <div className="field"><label>Effective date *</label><input required type="date" value={effectiveDate} onChange={e=>setEffectiveDate(e.target.value)}/></div>
     <div className="field full"><label>Approval document reference *</label><input required minLength={8} value={approvalReference} onChange={e=>setApprovalReference(e.target.value)} placeholder="Board minute / approved tariff schedule reference"/></div>
     {fields.map(k=><div className="field" key={k}><label>{k[0].toUpperCase()+k.slice(1)} (ZMW) *</label>
      <input required type="number" step="0.01" min="0" max="10000000" value={amounts[k]} onChange={e=>setAmounts(s=>({...s,[k]:e.target.value}))}/></div>)}
    </div>
    <p><strong>Total approved package: ZMW {total.toFixed(2)}</strong></p>
    <label style={{display:'flex',gap:8,alignItems:'start',marginBottom:16}}>
     <input type="checkbox" checked={confirmedApproval} onChange={e=>setConfirmedApproval(e.target.checked)}/>
     <span>I confirm these exact figures were formally approved, are effective as entered, and match the referenced approval document.</span>
    </label>
    <button type="submit" className="btn btn-primary" disabled={busy||!confirmedApproval}>{busy?'Registering…':'Register immutable approved tariff'}</button>
   </form>
  </section>}
  <section className="panel" style={{padding:20}}><h2>Approved versions</h2>
   <div className="table-scroll"><table className="data-table"><thead><tr><th>Programme / package</th><th>Version</th><th>Effective</th><th>Approved total</th><th>Approval reference</th></tr></thead>
    <tbody>{loading?<tr><td colSpan={5}>Loading…</td></tr>:tariffs.length===0?<tr><td colSpan={5}>No approved tariffs registered yet. Existing student balances cannot be confirmed.</td></tr>:
     tariffs.map(t=><tr key={t.id}><td>{t.programmeId} / {t.packageId}</td><td>{t.version}</td><td>{t.effectiveDate}</td><td>ZMW {t.total.toFixed(2)}</td><td>{t.approvalReference}</td></tr>)}</tbody>
   </table></div>
  </section>
 </>;
}
