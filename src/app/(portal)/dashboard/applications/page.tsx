'use client';
import {useEffect,useMemo,useState} from 'react';
import Image from 'next/image';
import {ArrowRight,Download,ExternalLink,Filter,Plus,Search,Trash2,X} from 'lucide-react';
import {api, cachedApi, PageHeader, StatusBadge} from '@/components/Portal';
import type {ApplicantRecord,SubmissionStatus} from '@/lib/types';
import {authHeaders} from '@/lib/firebase-client';
import type {IntakePolicy} from '@/lib/intake-policy';
const nextStages:Record<string,SubmissionStatus[]>={submitted:['under_review','needs_information','rejected'],under_review:['needs_information','accepted','rejected'],needs_information:['under_review','rejected'],accepted:['letter_issued','rejected'],letter_issued:['cdf_submitted','payment_verified','rejected'],cdf_submitted:['cdf_approved','rejected'],cdf_approved:['commission_paid'],payment_verified:['commission_paid']};
export default function Applications(){
 const [items,setItems]=useState<ApplicantRecord[]>([]),[q,setQ]=useState(''),[status,setStatus]=useState('all'),[selected,setSelected]=useState<ApplicantRecord|null>(null),[next,setNext]=useState(''),[cdfRef,setCdfRef]=useState(''),[payRef,setPayRef]=useState(''),[paidRef,setPaidRef]=useState(''),[paidAmount,setPaidAmount]=useState(''),[enrollmentConfirmed,setEnrollmentConfirmed]=useState(false),[intake,setIntake]=useState<IntakePolicy|null>(null),[note,setNote]=useState(''),[referralVerified,setReferralVerified]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[role,setRole]=useState('agent'),[loading,setLoading]=useState(true);
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

 async function deleteApplication(app: ApplicantRecord) {
  if (!window.confirm(`Are you sure you want to permanently delete application "${app.reference}"? This action cannot be reversed.`)) return;
  setBusy(true); setError(''); setMessage('');
  try {
   await api(`/api/admin/submissions/${app.id}`, { method: 'DELETE' });
   setMessage(`Application ${app.reference} has been deleted.`);
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
 useEffect(()=>{void refresh();cachedApi<{policy:IntakePolicy}>('/api/admin/intake',p=>setIntake(p.policy)).then(x=>setIntake(x.policy)).catch(()=>{});},[]);
 const filtered=useMemo(()=>items.filter(x=>(status==='all'||x.status===status)&&[x.reference,x.formTitle,...Object.values(x.answers).filter(v=>typeof v==='string')].join(' ').toLowerCase().includes(q.toLowerCase())),[items,q,status]);
 async function update(){if(!selected||!next)return;setError('');setMessage('');setBusy(true);try{
  await api(`/api/admin/submissions/${selected.id}`,{method:'PATCH',body:JSON.stringify({status:next,cdfReference:cdfRef,paymentReference:payRef,enrollmentPaymentReference:paidRef,enrollmentPaymentAmount:Number(paidAmount),enrollmentConfirmed,note,referralVerified})});
  setMessage('Application updated.');setSelected(null);setNext('');setCdfRef('');setPayRef('');setPaidRef('');setPaidAmount('');setEnrollmentConfirmed(false);setNote('');setReferralVerified(false);await refresh();
 }catch(e){setError(e instanceof Error?e.message:'Unable to update.');}finally{setBusy(false);}}
 async function uploadDocument(kind:string,file?:File){
  if(!selected||!file)return;
  setBusy(true);setError('');
  try{
   const headers=await authHeaders();
   const body=new FormData();body.append('kind',kind);body.append('file',file);
   const response=await fetch('/api/admin/submissions/'+selected.id+'/documents',{method:'POST',headers,body});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Document upload failed.');
   setMessage('CDF document received; a staff member must verify its contents.');await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Upload failed.');}finally{setBusy(false);}
 }
 async function verifyDocument(kind:string,verified:boolean){
  if(!selected)return;setBusy(true);setError('');
  try{await api('/api/admin/submissions/'+selected.id+'/documents',{method:'PATCH',body:JSON.stringify({kind,verified})});await refresh();setMessage('Document verification recorded.');}
  catch(e){setError(e instanceof Error?e.message:'Verification failed.');}finally{setBusy(false);}
 }
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
  return <><PageHeader title="Applications" subtitle="Review recruitment and student applications, verify CDF outcomes and manage commission records." action={role!=='agent'?<button className="btn btn-primary" onClick={()=>setCreatingApp(true)}><Plus size={16}/> New application</button>:undefined}/><div className="panel"><div className="table-controls"><label className="search-box"><Search size={18}/><input placeholder="Search applications or reference…" value={q} onChange={e=>setQ(e.target.value)}/></label><label className="filter-select"><Filter size={17}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{Object.keys(nextStages).concat('commission_paid','rejected').map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label></div>{message&&<div className="notice">{message}</div>}{error&&<div className="alert-error">{error}</div>}<div className="table-scroll"><table className="data-table"><thead><tr><th>Application</th><th>Type</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>{loading?Array.from({length:5}).map((_,i)=><tr key={'skel-app-'+i}><td colSpan={5} style={{padding:'12px 24px'}}><div className="skeleton-row"/></td></tr>):filtered.length>0?filtered.map(x=><tr key={x.id}><td><strong>{x.reference}</strong><small className="table-sub">{x.formTitle}</small></td><td className="capitalize">{x.formKind}</td><td>{new Date(x.submittedAt).toLocaleDateString()}</td><td><StatusBadge status={x.status}/></td><td><button className="text-link" onClick={()=>{setSelected(x);setNext('');setError('');}}>Details <ArrowRight size={15}/></button></td></tr>):<tr><td colSpan={5} className="empty-state">No applications match your search.</td></tr>}</tbody></table></div></div>
  {selected&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><section role="dialog" aria-modal="true" aria-label="Application details" className="detail-panel"><div className="drawer-header"><div><span className="overline">APPLICATION DETAILS</span><h2>{selected.reference}</h2><StatusBadge status={selected.status}/></div><button className="icon-btn" onClick={()=>setSelected(null)} aria-label="Close details"><X/></button></div><div className="drawer-content"><div className="detail-meta"><div><small>Form</small><strong>{selected.formTitle}</strong></div><div><small>Received</small><strong>{new Date(selected.submittedAt).toLocaleString()}</strong></div><div><small>Agent referral</small><strong>{selected.agentId?'Yes':'Direct application'}</strong></div></div><h3>Submitted answers</h3><dl className="answers-list">{Object.entries(selected.answers).map(([key,value])=><div key={key}><dt>{selected.formSnapshot?.sections.flatMap(s=>s.fields).find(f=>f.id===key)?.label||key.replaceAll('-',' ')}</dt><dd>{Array.isArray(value)?value.join(', '):value&&typeof value==='object'&&'path' in value?<button className="text-link" onClick={()=>void viewFile(key)}><ExternalLink size={14}/> Open private attachment</button>:typeof value==='string'&&/^https:\/\/res\.cloudinary\.com\//i.test(value)?<div style={{display:'flex',alignItems:'center',gap:10,marginTop:4}}><Image src={value} alt={key} width={54} height={54} unoptimized style={{objectFit:'cover',borderRadius:6,border:'1px solid var(--border)'}}/><a href={value} target="_blank" rel="noopener noreferrer" className="text-link"><ExternalLink size={14}/> View Cloudinary Image</a></div>:String(value||'—')}</dd></div>)}</dl>{role!=='agent'&&selected.formKind==='student'&&intake&&<div className="cdf-document-panel"><h3>CDF sponsorship documentation</h3><p className="muted">Government sponsorship is a payment pathway. All documents listed below must be uploaded and verified before official CDF approval can be recorded.</p>{intake.cdfRequiredDocuments.map(d=>{const entry=selected.documents?.[d.id];return <div key={d.id} className="admin-edit-item"><strong>{d.label}</strong><p className="muted">{entry?entry.fileName:'Missing document'} · {entry?.verifiedAt?'Verified':'Unverified'}</p><div className="inline-form">{entry&&<button className="text-link" onClick={()=>void openDocument(d.id)}>View</button>}{entry&&<button className="text-link" disabled={busy} onClick={()=>void verifyDocument(d.id,!entry.verifiedAt)}>{entry.verifiedAt?'Revoke verification':'Mark verified'}</button>}<input aria-label={'Upload '+d.label} type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} onChange={e=>void uploadDocument(d.id,e.target.files?.[0])}/></div></div>})}</div>}
  <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'12px 0'}}>{role!=='agent'&&selected.formKind==='student'&&['accepted','letter_issued','cdf_submitted','cdf_approved','payment_verified','commission_paid'].includes(selected.status)&&<button className="btn btn-outline" onClick={()=>void downloadLetter()}><Download size={16}/> Download acceptance letter (PDF)</button>}{role!=='agent'&&selected.formKind==='student'&&<button className="btn btn-outline" onClick={()=>void downloadEnrollmentForm()}><Download size={16}/> Download enrollment form (PDF)</button>}</div>{selected.paymentVerification&&<div className="notice"><strong>Verified enrollment payment</strong><br/>{selected.paymentVerification.reference} · K{selected.paymentVerification.amount.toFixed(2)}</div>}{selected.cdfVerification&&<div className="notice"><strong>Verified CDF reference</strong><br/>{selected.cdfVerification.reference}</div>}{selected.commission&&<div className="notice"><strong>Agent commission</strong><br/>K{selected.commission.amount.toFixed(2)} · {selected.commission.paidAt?'Paid':'Awaiting payment'}</div>}
  {role!=='agent'&&<div className="status-editor"><h3>Update application</h3><div className="field"><label>Next status</label><select value={next} onChange={e=>setNext(e.target.value)}><option value="">Select action</option>{(selected.formKind==='student'?nextStages[selected.status]||[]:(nextStages[selected.status]||[]).filter(s=>!['letter_issued','cdf_submitted','cdf_approved','payment_verified','commission_paid'].includes(s))).filter(s=>(s!=='commission_paid'||Boolean(selected.commission))&&(role!=='reviewer'||!['cdf_approved','payment_verified','commission_paid'].includes(s))).map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></div>{next==='cdf_approved'&&<div className="field"><label>Official CDF approval reference</label><input value={cdfRef} onChange={e=>setCdfRef(e.target.value)} placeholder="Verification reference or record ID"/></div>}{next==='payment_verified'&&<label className="required-toggle"><input type="checkbox" checked={enrollmentConfirmed} onChange={e=>setEnrollmentConfirmed(e.target.checked)}/>I independently verified successful enrollment and the required payment amount.</label>}{next==='payment_verified'&&<div className="field"><label>Verified student enrollment payment reference</label><input value={paidRef} onChange={e=>setPaidRef(e.target.value)} placeholder="Bank, mobile money or tuition receipt number"/></div>}{next==='payment_verified'&&<div className="field"><label>Verified amount paid (ZMW)</label><input type="number" min="0.01" step="0.01" value={paidAmount} onChange={e=>setPaidAmount(e.target.value)}/></div>}{['cdf_approved','payment_verified'].includes(next)&&selected.agentId&&selected.formKind==='student'&&<label className="required-toggle"><input type="checkbox" checked={referralVerified} onChange={e=>setReferralVerified(e.target.checked)}/> I have independently verified this agent&apos;s referral</label>}{next==='commission_paid'&&<div className="field"><label>Payment transaction reference</label><input value={payRef} onChange={e=>setPayRef(e.target.value)} placeholder="Bank / mobile money transfer reference"/></div>}<div className="field"><label>Internal review note (optional)</label><textarea rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Record reasons, reviewer evidence or follow-up instructions"/></div>{error&&<div className="alert-error">{error}</div>}<button className="btn btn-primary btn-full" disabled={!next||busy} onClick={()=>void update()}>{busy?'Updating…':'Confirm status change'}</button>
  {['super_admin','admin'].includes(role)&&<div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--border)'}}>
   <button type="button" className="btn btn-outline" style={{width:'100%',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',display:'flex',alignItems:'center',justifyContent:'center',gap:8}} disabled={busy} onClick={()=>void deleteApplication(selected)}>
    <Trash2 size={16}/> Delete this application permanently
   </button>
  </div>}
  </div>}</div></section></div>}
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
