'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {ArrowLeft,ArrowRight,Download,ExternalLink,Filter,Plus,Search,Trash2,X,Pencil,CheckSquare,Square,FileDown,Mail,Upload} from 'lucide-react';
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
 letter_issued:['under_review','cdf_submitted','payment_verified','rejected'],
 cdf_submitted:['cdf_approved','rejected'],
 cdf_approved:['cdf_funds_received'],
 cdf_funds_received:['commission_paid'],
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
 const [bulkDeleteTarget,setBulkDeleteTarget]=useState<'selected'|'all'|null>(null);

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

 async function confirmBulkDelete() {
  if (!bulkDeleteTarget) return;
  setBusy(true); setError(''); setMessage('');
  try {
   const idsToDelete = bulkDeleteTarget === 'selected' ? Array.from(selectedIds) : filtered.map(x => x.id);
   for (const id of idsToDelete) {
    await api(`/api/admin/submissions/${id}`, { method: 'DELETE' });
   }
   setMessage(`Successfully deleted ${idsToDelete.length} application record(s).`);
   setSelectedIds(new Set());
   setBulkDeleteTarget(null);
   await refresh(true);
  } catch (err) {
   setError(err instanceof Error ? err.message : 'Bulk delete failed.');
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

 useEffect(() => {
  if (!creatingApp) return;
  const handleKeyDown = (e: KeyboardEvent) => {
   if (e.key === 'Escape') setCreatingApp(false);
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
 }, [creatingApp]);

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

 async function handleBatchEmail() {
  setBusy(true); setError(''); setMessage('');
  try {
   const res = await api<{ok: boolean; message: string; queuedCount: number; skippedCount: number}>('/api/admin/submissions/batch-email', {
    method: 'POST',
    body: JSON.stringify({ ids: Array.from(selectedIds) })
   });
   setMessage(res.message);
  } catch (err) {
   setError(err instanceof Error ? err.message : 'Batch notification dispatch failed.');
  } finally {
   setBusy(false);
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

 return <><PageHeader title="Applications" subtitle="Review admission separately from offers, verified tuition receipts, government CDF approval and confirmed government remittances. The commission ledger is funded-enrollment-only." action={role!=='agent'?<Link href="/dashboard/applications/new" className="btn btn-primary" style={{display:'inline-flex',alignItems:'center',gap:6}}><Plus size={16}/> New application</Link>:undefined}/>
 <div className="panel">
  <div className="table-controls" style={{flexWrap:'wrap',gap:12}}>
   <label className="search-box"><Search size={18}/><input placeholder="Search applications or reference…" value={q} onChange={e=>setQ(e.target.value)}/></label>
   <label className="filter-select"><Filter size={17}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{Object.keys(nextStages).concat('commission_paid','rejected').map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label>
   <div style={{display:'flex',gap:8,marginLeft:'auto',flexWrap:'wrap'}}>
    {selectedIds.size>0&&<button className="btn btn-outline" disabled={busy} onClick={()=>void handleBatchEmail()} style={{fontSize:12,padding:'8px 12px',display:'inline-flex',alignItems:'center',gap:6}}><Mail size={14}/> Notify linked students ({selectedIds.size})</button>}
    {selectedIds.size>0&&<button className="btn btn-outline" disabled={downloadingBatch} onClick={()=>void handleBatchDownload()} style={{fontSize:12,padding:'8px 12px',display:'inline-flex',alignItems:'center',gap:6}}><FileDown size={14}/> Download Selected ({selectedIds.size})</button>}
    <button className="btn btn-outline" disabled={downloadingBatch||filtered.length===0} onClick={()=>void handleBatchDownload([])} style={{fontSize:12,padding:'8px 12px',display:'inline-flex',alignItems:'center',gap:6}}><Download size={14}/> Download All (CSV)</button>
    {selectedIds.size>0&&['super_admin','admin'].includes(role)&&<button className="btn btn-outline" disabled={busy} onClick={()=>setBulkDeleteTarget('selected')} style={{fontSize:12,padding:'8px 12px',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',display:'inline-flex',alignItems:'center',gap:6}}><Trash2 size={14}/> Delete Selected ({selectedIds.size})</button>}
    {filtered.length>0&&['super_admin','admin'].includes(role)&&<button className="btn btn-outline" disabled={busy} onClick={()=>setBulkDeleteTarget('all')} style={{fontSize:12,padding:'8px 12px',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',display:'inline-flex',alignItems:'center',gap:6}}><Trash2 size={14}/> Delete All ({filtered.length})</button>}
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

 <ConfirmModal
  isOpen={Boolean(bulkDeleteTarget)}
  title="Delete Multiple Applications"
  message={`Are you sure you want to permanently delete ${bulkDeleteTarget === 'selected' ? `${selectedIds.size} selected` : `all ${filtered.length}`} application(s)? This action cannot be reversed.`}
  kind="danger"
  confirmLabel="Delete Applications"
  cancelLabel="Cancel"
  busy={busy}
  onConfirm={()=>void confirmBulkDelete()}
  onCancel={()=>setBulkDeleteTarget(null)}
 />
 </>;
}
