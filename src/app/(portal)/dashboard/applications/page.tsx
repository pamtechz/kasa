'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {ArrowRight,Download,ExternalLink,Filter,Plus,Search,Trash2,X,Pencil,CheckSquare,Square,FileDown} from 'lucide-react';
import {api, cachedApi, PageHeader, StatusBadge} from '@/components/Portal';
import {ConfirmModal} from '@/components/ConfirmModal';
import type {ApplicantRecord,SubmissionStatus} from '@/lib/types';
import {authHeaders} from '@/lib/firebase-client';
import type {IntakePolicy} from '@/lib/intake-policy';

const nextStages:Record<string,SubmissionStatus[]>={
 submitted:['under_review','needs_information','rejected'],
 under_review:['needs_information','accepted','rejected'],
 needs_information:['under_review','rejected'],
 accepted:['letter_issued','rejected'],
 letter_issued:['cdf_submitted','payment_verified','rejected'],
 cdf_submitted:['cdf_approved','rejected'],
 cdf_approved:['commission_paid'],
 payment_verified:['commission_paid']
};

export default function Applications(){
 const [items,setItems]=useState<ApplicantRecord[]>([]);
 const [q,setQ]=useState('');
 const [status,setStatus]=useState('all');
 const [selected,setSelected]=useState<ApplicantRecord|null>(null);
 const [deletingApp,setDeletingApp]=useState<ApplicantRecord|null>(null);
 const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set());
 const [downloadingBatch,setDownloadingBatch]=useState(false);

 const [next,setNext]=useState('');
 const [cdfRef,setCdfRef]=useState('');
 const [payRef,setPayRef]=useState('');
 const [paidRef,setPaidRef]=useState('');
 const [paidAmount,setPaidAmount]=useState('');
 const [enrollmentConfirmed,setEnrollmentConfirmed]=useState(false);
 const [intake,setIntake]=useState<IntakePolicy|null>(null);
 const [note,setNote]=useState('');
 const [referralVerified,setReferralVerified]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [role,setRole]=useState('agent');
 const [loading,setLoading]=useState(true);

 const [creatingApp, setCreatingApp] = useState(false);
 const [newName, setNewName] = useState('');
 const [newEmail, setNewEmail] = useState('');
 const [newPhone, setNewPhone] = useState('');
 const [newNrc, setNewNrc] = useState('');
 const [newProgramme, setNewProgramme] = useState('');
 const [newFundingMethod, setNewFundingMethod] = useState<'cdf' | 'self_funded'>('cdf');
 const [newDistrict, setNewDistrict] = useState('');
 const [newStatus, setNewStatus] = useState<SubmissionStatus>('submitted');
 const [newNote, setNewNote] = useState('');

 async function createApplication(e: React.FormEvent) {
  e.preventDefault();
  if (!newName.trim() || !newProgramme.trim()) return;
  setBusy(true); setError(''); setMessage('');
  try {
   const res = await api<{ok: boolean; id: string; reference: string}>('/api/admin/submissions', {
    method: 'POST',
    body: JSON.stringify({
     name: newName,
     email: newEmail,
     phone: newPhone,
     nrc: newNrc,
     programme: newProgramme,
     fundingMethod: newFundingMethod,
     district: newDistrict,
     status: newStatus,
     note: newNote
    })
   });
   setMessage(`Application registered successfully (Reference: ${res.reference})`);
   setCreatingApp(false);
   setNewName(''); setNewEmail(''); setNewPhone(''); setNewNrc(''); setNewProgramme(''); setNewDistrict(''); setNewNote('');
   await refresh(true);
  } catch (err) {
   setError(err instanceof Error ? err.message : 'Unable to create application.');
  } finally {
   setBusy(false);
  }
 }

 async function confirmDeleteApplication() {
  if (!deletingApp) return;
  setBusy(true); setError(''); setMessage('');
  try {
   await api(`/api/admin/submissions/${deletingApp.id}`, { method: 'DELETE' });
   setMessage(`Application ${deletingApp.reference} has been deleted.`);
   setDeletingApp(null);
   setSelected(null);
   await refresh(true);
  } catch (err) {
   setError(err instanceof Error ? err.message : 'Unable to delete application.');
  } finally {
   setBusy(false);
  }
 }

 async function refresh(force=false){
  try{
   if(force){
    const a=await api<{submissions:ApplicantRecord[]}>('/api/admin/submissions');
    setItems(a.submissions);
    setSelected(prev=>prev?a.submissions.find(x=>x.id===prev.id)||prev:null);
    const me=await api<{profile:{role:string}}>('/api/me');
    setRole(me.profile.role);
   }else{
    const [a,me]=await Promise.all([
     cachedApi<{submissions:ApplicantRecord[]}>('/api/admin/submissions',fresh=>{
      setItems(fresh.submissions);
      setSelected(prev=>prev?fresh.submissions.find(x=>x.id===prev.id)||prev:null);
     }),
     cachedApi<{profile:{role:string}}>('/api/me',fresh=>setRole(fresh.profile.role))
    ]);
    setItems(a.submissions);
    setSelected(prev=>prev?a.submissions.find(x=>x.id===prev.id)||prev:null);
    setRole(me.profile.role);
   }
  }catch(e){setError(e instanceof Error?e.message:'Unable to load.')}finally{setLoading(false);}}

 useEffect(()=>{
  void refresh();
  cachedApi<{policy:IntakePolicy}>('/api/admin/intake',p=>setIntake(p.policy)).then(x=>setIntake(x.policy)).catch(()=>{});
 },[]);

 const filtered=useMemo(()=>items.filter(x=>(status==='all'||x.status===status)&&[x.reference,x.formTitle,...Object.values(x.answers).filter(v=>typeof v==='string')].join(' ').toLowerCase().includes(q.toLowerCase())),[items,q,status]);

 const allSelected = filtered.length > 0 && filtered.every(x => selectedIds.has(x.id));

 function toggleSelectAll() {
  if (allSelected) {
   setSelectedIds(new Set());
  } else {
   setSelectedIds(new Set(filtered.map(x => x.id)));
  }
 }

 function toggleSelect(id: string) {
  const next = new Set(selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  setSelectedIds(next);
 }

 async function handleBatchDownload(idsToDownload?: string[]) {
  setDownloadingBatch(true);
  setError('');
  try {
   const headers = await authHeaders();
   const res = await fetch('/api/admin/submissions/batch-download', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: idsToDownload || Array.from(selectedIds) })
   });
   if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Error(data.error || 'Batch download failed.');
   }
   const blob = await res.blob();
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = `KASA-Applications-Export-${new Date().toISOString().slice(0,10)}.csv`;
   a.click();
   setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (err) {
   setError(err instanceof Error ? err.message : 'Batch download failed.');
  } finally {
   setDownloadingBatch(false);
  }
 }

 async function update(){if(!selected||!next)return;setError('');setMessage('');setBusy(true);try{
  await api(`/api/admin/submissions/${selected.id}`,{method:'PATCH',body:JSON.stringify({status:next,cdfReference:cdfRef,paymentReference:payRef,enrollmentPaymentReference:paidRef,enrollmentPaymentAmount:Number(paidAmount),enrollmentConfirmed,note,referralVerified})});
  setMessage('Application updated.');setSelected(null);setNext('');setCdfRef('');setPayRef('');setPaidRef('');setPaidAmount('');setEnrollmentConfirmed(false);setNote('');setReferralVerified(false);await refresh();
 }catch(e){setError(e instanceof Error?e.message:'Unable to update.');}finally{setBusy(false);}}

 async function openDocument(kind:string){
  if(!selected)return;
  try{
   const result=await api<{url:string}>('/api/admin/submissions/'+selected.id+'/documents?kind='+encodeURIComponent(kind));
   window.open(result.url,'_blank','noopener,noreferrer');
  }catch(e){setError(e instanceof Error?e.message:'Unable to open document.');}
 }

 async function downloadEnrollmentForm(){if(!selected)return;setError('');try{const headers=await authHeaders();const res=await fetch(`/api/admin/submissions/${selected.id}/enrollment-form`,{headers});if(!res.ok){const body=await res.json();throw Error(body.error||'Unable to generate enrollment form.');}const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`KASA-Enrollment-${selected.reference}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(e){setError(e instanceof Error?e.message:'Unable to download enrollment form.');}}
 async function downloadLetter(){if(!selected)return;setError('');try{const headers=await authHeaders();const res=await fetch(`/api/admin/submissions/${selected.id}/letter`,{headers});if(!res.ok){const body=await res.json();throw Error(body.error||'Unable to generate letter.');}const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`KASA-Acceptance-${selected.reference}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(e){setError(e instanceof Error?e.message:'Unable to download letter.');}}
 async function viewFile(field:string){if(!selected)return;try{const result=await api<{url:string}>(`/api/admin/file?submissionId=${selected.id}&fieldId=${encodeURIComponent(field)}`);window.open(result.url,'_blank','noopener,noreferrer');}catch(e){setError(e instanceof Error?e.message:'Unable to open attachment.');}}

 return <><PageHeader title="Applications" subtitle="Review recruitment and student applications, verify CDF outcomes and manage commission records." action={role!=='agent'?<button className="btn btn-primary" onClick={()=>setCreatingApp(true)}><Plus size={16}/> New application</button>:undefined}/>
 <div className="panel">
  <div className="table-controls" style={{flexWrap:'wrap',gap:12}}>
   <label className="search-box"><Search size={18}/><input placeholder="Search applications or reference…" value={q} onChange={e=>setQ(e.target.value)}/></label>
   <label className="filter-select"><Filter size={17}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{Object.keys(nextStages).concat('commission_paid','rejected').map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label>
   <div style={{display:'flex',gap:8,marginLeft:'auto'}}>
    {selectedIds.size>0&&<button className="btn btn-outline" disabled={downloadingBatch} onClick={()=>void handleBatchDownload()} style={{fontSize:12,padding:'8px 12px',display:'inline-flex',alignItems:'center',gap:6}}><FileDown size={14}/> Download Selected ({selectedIds.size})</button>}
    <button className="btn btn-outline" disabled={downloadingBatch||filtered.length===0} onClick={()=>void handleBatchDownload([])} style={{fontSize:12,padding:'8px 12px',display:'inline-flex',alignItems:'center',gap:6}}><Download size={14}/> Download All (CSV)</button>
   </div>
  </div>
  {message&&<div className="notice">{message}</div>}
  {error&&<div className="alert-error">{error}</div>}
  <div className="table-scroll">
   <table className="data-table">
    <thead>
     <tr>
      <th style={{width:40}}><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all applications"/></th>
      <th>Application</th>
      <th>Type</th>
      <th>Submitted</th>
      <th>Status</th>
      <th>Actions</th>
     </tr>
    </thead>
    <tbody>
     {loading?Array.from({length:5}).map((_,i)=><tr key={'skel-app-'+i}><td colSpan={6} style={{padding:'12px 24px'}}><div className="skeleton-row"/></td></tr>):filtered.length>0?filtered.map(x=><tr key={x.id}>
      <td><input type="checkbox" checked={selectedIds.has(x.id)} onChange={()=>toggleSelect(x.id)} aria-label={`Select ${x.reference}`}/></td>
      <td><strong>{x.reference}</strong><small className="table-sub">{x.formTitle}</small></td>
      <td className="capitalize">{x.formKind}</td>
      <td>{new Date(x.submittedAt).toLocaleDateString()}</td>
      <td><StatusBadge status={x.status}/></td>
      <td>
       <div style={{display:'flex',alignItems:'center',gap:12}}>
        <Link href={`/dashboard/applications/${x.id}`} className="text-link" style={{display:'inline-flex',alignItems:'center',gap:4}}><Pencil size={15}/> Edit</Link>
        {['super_admin','admin'].includes(role)&&<button className="text-link" style={{color:'#ef4444',display:'inline-flex',alignItems:'center',gap:4}} onClick={()=>setDeletingApp(x)} title="Delete Application"><Trash2 size={15}/> Delete</button>}
       </div>
      </td>
     </tr>):<tr><td colSpan={6} className="empty-state">No applications match your search.</td></tr>}
    </tbody>
   </table>
  </div>
 </div>

 <ConfirmModal
  isOpen={Boolean(deletingApp)}
  title="Delete Application Permanently"
  message={`Are you sure you want to permanently delete application "${deletingApp?.reference}"? This action cannot be reversed.`}
  kind="danger"
  confirmLabel="Delete Application"
  cancelLabel="Cancel"
  busy={busy}
  onConfirm={()=>void confirmDeleteApplication()}
  onCancel={()=>setDeletingApp(null)}
 />

 {creatingApp&&(
  <div className="modal-page-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setCreatingApp(false);}}>
   <div className="modal-page" role="dialog" aria-modal="true" aria-label="Register New Application">
    <div className="modal-page-header">
     <div className="modal-page-header-left">
      <span className="modal-page-badge">MANUAL ENTRY</span>
      <h2>Register New Application</h2>
     </div>
     <div className="modal-page-header-right">
      <button className="icon-btn modal-page-close-btn" type="button" onClick={()=>setCreatingApp(false)} aria-label="Close modal"><X size={20}/></button>
     </div>
    </div>
    <form onSubmit={e=>void createApplication(e)} style={{display:'flex',flexDirection:'column',flex:1}}>
     <div className="modal-page-body">
      <div className="modal-page-card">
       <h3>Applicant Details</h3>
       <p className="muted">Enter student records directly for offline or sponsored applicants.</p>
       <div className="form-grid">
        <div className="field full"><label>Student full name *</label><input required placeholder="E.g. Chisamba Mumba" value={newName} onChange={e=>setNewName(e.target.value)}/></div>
        <div className="field"><label>Email address</label><input type="email" placeholder="student@example.com" value={newEmail} onChange={e=>setNewEmail(e.target.value)}/></div>
        <div className="field"><label>Phone number</label><input type="tel" placeholder="+260 97..." value={newPhone} onChange={e=>setNewPhone(e.target.value)}/></div>
        <div className="field"><label>NRC / National ID Number</label><input placeholder="123456/10/1" value={newNrc} onChange={e=>setNewNrc(e.target.value)}/></div>
        <div className="field"><label>District / Town</label><input placeholder="E.g. Lusaka, Chibombo" value={newDistrict} onChange={e=>setNewDistrict(e.target.value)}/></div>
       </div>
      </div>
      <div className="modal-page-card">
       <h3>Programme & Sponsorship</h3>
       <div className="form-grid">
        <div className="field full"><label>Programme / Course name *</label><input required placeholder="E.g. General Agriculture (TEVETA Level II)" value={newProgramme} onChange={e=>setNewProgramme(e.target.value)}/></div>
        <div className="field"><label>Funding pathway</label><select value={newFundingMethod} onChange={e=>setNewFundingMethod(e.target.value as 'cdf'|'self_funded')}><option value="cdf">Constituency Development Fund (CDF)</option><option value="self_funded">Self-funded / Private</option></select></div>
        <div className="field"><label>Initial status</label><select value={newStatus} onChange={e=>setNewStatus(e.target.value as SubmissionStatus)}><option value="submitted">Submitted</option><option value="under_review">Under Review</option><option value="accepted">Accepted</option></select></div>
        <div className="field full"><label>Internal notes</label><textarea rows={3} placeholder="Add any background notes or intake details..." value={newNote} onChange={e=>setNewNote(e.target.value)}/></div>
       </div>
      </div>
     </div>
     <div className="modal-page-footer">
      <button className="btn btn-outline" type="button" onClick={()=>setCreatingApp(false)}>Cancel</button>
      <button className="btn btn-primary" type="submit" disabled={busy||!newName.trim()||!newProgramme.trim()}><Plus size={16}/>{busy?'Registering…':'Create application'}</button>
     </div>
    </form>
   </div>
  </div>
 )}
 </>;
}
