'use client';
import {use,useEffect,useState,useCallback} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Download,ExternalLink,FileText,ShieldCheck,Trash2,CheckCircle2,Clock,User,Award,Coins} from 'lucide-react';
import {api,PageHeader,StatusBadge} from '@/components/Portal';
import type {ApplicantRecord,SubmissionStatus} from '@/lib/types';
import {ConfirmModal} from '@/components/ConfirmModal';
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

export default function ApplicationDetailPage({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);
 const [selected,setSelected]=useState<ApplicantRecord|null>(null);
 const [next,setNext]=useState('');
 const [cdfRef,setCdfRef]=useState('');
 const [cdfAuthority,setCdfAuthority]=useState('');
 const [governmentRef,setGovernmentRef]=useState('');
 const [bankRef,setBankRef]=useState('');
 const [cdfAmount,setCdfAmount]=useState('');
 const [cdfEnrollmentConfirmed,setCdfEnrollmentConfirmed]=useState(false);
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
 const [confirmingDelete,setConfirmingDelete]=useState(false);
 const router=useRouter();

 const loadApplication = useCallback(async () => {
  setLoading(true);
  try{
   const [submissionsRes,meRes,intakeRes]=await Promise.all([
    api<{submissions:ApplicantRecord[]}>('/api/admin/submissions'),
    api<{profile:{role:string}}>('/api/me'),
    api<{policy:IntakePolicy}>('/api/admin/intake').catch(()=>({policy:null}))
   ]);
   setRole(meRes.profile.role);
   if(intakeRes.policy)setIntake(intakeRes.policy);
   const app=submissionsRes.submissions.find(x=>x.id===id);
   if(!app){
    setError('Application not found.');
   }else{
    setSelected(app);
   }
  }catch(e){
   setError(e instanceof Error?e.message:'Unable to load application details.');
  }finally{
   setLoading(false);
  }
 }, [id]);

 useEffect(()=>{
  void loadApplication();
 },[loadApplication]);

 async function updateStatus(){
  if(!selected||!next)return;
  setError('');
  setMessage('');
  setBusy(true);
  try{
   await api(`/api/admin/submissions/${selected.id}`,{
    method:'PATCH',
    body:JSON.stringify({
     status:next,
     cdfReference:cdfRef,
     cdfApprovingAuthority:cdfAuthority,
     cdfGovernmentPaymentReference:governmentRef,cdfBankReceiptReference:bankRef,
     cdfAmountReceived:Number(cdfAmount),cdfEnrollmentConfirmed,
     paymentReference:payRef,
     enrollmentPaymentReference:paidRef,
     enrollmentPaymentAmount:Number(paidAmount),
     enrollmentConfirmed,
     note,
     referralVerified
    })
   });
   setMessage('Application status updated successfully.');
   setNext(''); setCdfRef('');setCdfAuthority('');setGovernmentRef('');setBankRef('');setCdfAmount('');setCdfEnrollmentConfirmed(false); setPayRef(''); setPaidRef(''); setPaidAmount('');
   setEnrollmentConfirmed(false); setNote(''); setReferralVerified(false);
   await loadApplication();
  }catch(e){
   setError(e instanceof Error?e.message:'Unable to update status.');
  }finally{
   setBusy(false);
  }
 }

 async function deleteAppPermanently(){
  if(!selected)return;
  setBusy(true);
  setError('');
  try{
   await api(`/api/admin/submissions/${selected.id}`,{method:'DELETE'});
   router.push('/dashboard/applications');
  }catch(e){
   setError(e instanceof Error?e.message:'Unable to delete application.');
   setBusy(false);
  }
 }

 async function uploadDocument(kind:string,file?:File){
  if(!selected||!file)return;
  setBusy(true);setError('');
  try{
   const headers=await authHeaders();
   const body=new FormData();body.append('kind',kind);body.append('file',file);
   const response=await fetch('/api/admin/submissions/'+selected.id+'/documents',{method:'POST',headers,body});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Document upload failed.');
   setMessage('Document uploaded successfully.');
   await loadApplication();
  }catch(e){setError(e instanceof Error?e.message:'Upload failed.');}finally{setBusy(false);}
 }

 async function verifyDocument(kind:string,verified:boolean){
  if(!selected)return;setBusy(true);setError('');
  try{
   await api('/api/admin/submissions/'+selected.id+'/documents',{method:'PATCH',body:JSON.stringify({kind,verified})});
   await loadApplication();
   setMessage('Document verification updated.');
  }catch(e){setError(e instanceof Error?e.message:'Verification failed.');}finally{setBusy(false);}
 }

 async function openDocument(kind:string){
  if(!selected)return;
  try{
   const result=await api<{url:string}>('/api/admin/submissions/'+selected.id+'/documents?kind='+encodeURIComponent(kind));
   window.open(result.url,'_blank','noopener,noreferrer');
  }catch(e){setError(e instanceof Error?e.message:'Unable to open document.');}
 }

 async function downloadEnrollmentForm(){
  if(!selected)return;
  setError('');
  try{
   const headers=await authHeaders();
   const res=await fetch(`/api/admin/submissions/${selected.id}/enrollment-form`,{headers});
   if(!res.ok){
    const body=await res.json();throw Error(body.error||'Unable to generate enrollment form.');
   }
   const blob=await res.blob();
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=url;a.download=`KASA-Enrollment-${selected.reference}.pdf`;a.click();
   setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch(e){setError(e instanceof Error?e.message:'Unable to download enrollment form.');}
 }

 async function downloadLetter(){
  if(!selected)return;
  setError('');
  try{
   const headers=await authHeaders();
   const res=await fetch(`/api/admin/submissions/${selected.id}/letter`,{headers});
   if(!res.ok){
    const body=await res.json();throw Error(body.error||'Unable to generate letter.');
   }
   const blob=await res.blob();
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=url;a.download=`KASA-Acceptance-${selected.reference}.pdf`;a.click();
   setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch(e){setError(e instanceof Error?e.message:'Unable to download acceptance letter.');}
 }

 async function viewFile(field:string){
  if(!selected)return;
  try{
   const result=await api<{url:string}>(`/api/admin/file?submissionId=${selected.id}&fieldId=${encodeURIComponent(field)}`);
   window.open(result.url,'_blank','noopener,noreferrer');
  }catch(e){setError(e instanceof Error?e.message:'Unable to open attachment.');}
 }

 if(loading){
  return <div className="panel pad-panel" style={{textAlign:'center',padding:60}}><p className="muted">Loading application details…</p></div>;
 }

 if(!selected){
  return <div className="panel pad-panel">
   <Link href="/dashboard/applications" className="text-link" style={{marginBottom:16}}><ArrowLeft size={16}/> Back to Applications</Link>
   <div className="alert-error" style={{marginTop:16}}>{error||'Application not found.'}</div>
  </div>;
 }

 return <div className="app-detail-page">
  <div style={{marginBottom:20}}>
   <Link href="/dashboard/applications" className="text-link"><ArrowLeft size={16}/> Back to Applications List</Link>
  </div>

  <PageHeader
   title={`Application: ${selected.reference}`}
   subtitle={`Submitted ${new Date(selected.submittedAt).toLocaleString()} · ${selected.formTitle}`}
   action={<StatusBadge status={selected.status}/>}
  />

  {message&&<div className="notice" style={{marginBottom:20}}>{message}</div>}
  {error&&<div className="alert-error" style={{marginBottom:20}}>{error}</div>}

  <div className="settings-grid">
   <main style={{display:'grid',gap:20}}>
    <div className="panel pad-panel">
     <h2>Application Overview</h2>
     <p className="muted">Admission is confirmed through staff review and a separately issued, quoted offer. Government CDF sponsorship approval is not cash received; only full, reconciled self-funded or government payments can complete funding and support commission.</p>
     {selected.status==='cdf_approved'&&<p className="notice">Government sponsorship approved — funds not yet confirmed received by KASA. Do not issue a student ID or award commission.</p>}
     {selected.status==='letter_issued'&&<p className="notice">Offer issued — tuition payment or government CDF support remains pending verification.</p>}
     <div className="detail-meta" style={{margin:'16px 0'}}>
      <div><small>Reference</small><strong>{selected.reference}</strong></div>
      <div><small>Form Title</small><strong>{selected.formTitle}</strong></div>
      <div><small>Funding Method</small><strong style={{textTransform:'uppercase'}}>{selected.fundingMethod?.replaceAll('_',' ')||"Self-Funded / Undefined"}</strong></div>
      <div><small>Agent Referral</small><strong>{selected.agentId?'Agent Attributed':'Direct Application'}</strong></div>
     </div>

     <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:20}}>
      {role!=='agent'&&selected.formKind==='student'&&['letter_issued','cdf_submitted','cdf_approved','payment_verified','commission_paid'].includes(selected.status)&&(
       <button className="btn btn-primary" type="button" onClick={()=>void downloadLetter()}><Download size={16}/> Download Acceptance Pack (PDF)</button>
      )}
      {role!=='agent'&&selected.formKind==='student'&&(
       <button className="btn btn-outline" type="button" onClick={()=>void downloadEnrollmentForm()}><Download size={16}/> Download Enrollment Form (PDF)</button>
      )}
     </div>
    </div>

    <div className="panel pad-panel">
     <h2>Submitted Answers</h2>
     <dl className="answers-list" style={{marginTop:16}}>
      {Object.entries(selected.answers).map(([key,value])=><div key={key}>
       <dt>{selected.formSnapshot?.sections.flatMap(s=>s.fields).find(f=>f.id===key)?.label||key.replaceAll('-',' ')}</dt>
       <dd>
        {Array.isArray(value)?value.join(', '):value&&typeof value==='object'&&'path' in value?(
         <button className="text-link" onClick={()=>void viewFile(key)}><ExternalLink size={14}/> Open Attachment</button>
        ):typeof value==='string'&&/^https:\/\/res\.cloudinary\.com\//i.test(value)?(
         <div style={{display:'flex',alignItems:'center',gap:12,marginTop:6}}>
          <Image src={value} alt={key} width={70} height={70} unoptimized style={{objectFit:'cover',borderRadius:8,border:'1px solid var(--border)'}}/>
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-link"><ExternalLink size={14}/> Open Cloudinary Image</a>
         </div>
        ):String(value||'—')}
       </dd>
      </div>)}
     </dl>
    </div>

    {role!=='agent'&&selected.formKind==='student'&&intake&&(
     <div className="panel pad-panel">
      <h2>CDF Sponsorship Documentation</h2>
      <p className="muted">Verify required documents submitted for government sponsorship approval.</p>
      <div style={{display:'grid',gap:14,marginTop:16}}>
       {intake.cdfRequiredDocuments.map(d=>{
        const entry=selected.documents?.[d.id];
        return <div key={d.id} className="admin-edit-item">
         <strong>{d.label}</strong>
         <p className="muted">{entry?entry.fileName:'No document uploaded yet'} · {entry?.verifiedAt?'✓ Verified':'Unverified'}</p>
         <div className="inline-form">
          {entry&&<button className="text-link" type="button" onClick={()=>void openDocument(d.id)}>View File</button>}
          {entry&&<button className="text-link" type="button" disabled={busy} onClick={()=>void verifyDocument(d.id,!entry.verifiedAt)}>{entry.verifiedAt?'Revoke Verification':'Mark Verified'}</button>}
          <input aria-label={'Upload '+d.label} type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} onChange={e=>void uploadDocument(d.id,e.target.files?.[0])}/>
         </div>
        </div>;
       })}
      </div>
     </div>
    )}
   </main>

   <aside style={{display:'grid',gap:20}}>
    {role!=='agent'&&(
     <div className="panel pad-panel">
      <h2>Update Application Status</h2>
      <p className="muted">Admission review, offer issue, official CDF approval, actual government payment and commission disbursement are separate audited decisions. An approval notice alone does not prove the fees were received.</p>

      <div className="field" style={{marginTop:16}}>
       <label>Next Status Action</label>
       <select value={next} onChange={e=>setNext(e.target.value)}>
        <option value="">Select Action</option>
        {(selected.formKind==='student'?nextStages[selected.status]||[]:(nextStages[selected.status]||[]).filter(s=>!['letter_issued','cdf_submitted','cdf_approved','cdf_funds_received','payment_verified','commission_paid'].includes(s)))
         .filter(s=>(s!=='under_review'||selected.status!=='letter_issued'||selected.autoApproved===true)&&(s!=='commission_paid'||Boolean(selected.commission))&&(role!=='reviewer'||!['cdf_approved','cdf_funds_received','payment_verified','commission_paid'].includes(s)))
         .map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}
       </select>
      </div>

      {next==='cdf_approved'&&(
       <><div className="field"><label>Official CDF Government Approval Reference</label><input value={cdfRef} onChange={e=>setCdfRef(e.target.value)} placeholder="Official approval document reference"/></div>
   <div className="field"><label>Issuing government / CDF authority</label><input value={cdfAuthority} onChange={e=>setCdfAuthority(e.target.value)} placeholder="Government authority verifying award"/></div>
   <p className="muted">This establishes government sponsorship authorization only. No fees or commission are earned at this stage.</p></>
      )}

      {next==='cdf_funds_received'&&(<>
       <p className="muted"><strong>Government money received by KASA:</strong> independently inspect the government transfer advice, the institution bank statement, full approved fee quote and the student enrollment. An approval letter is not sufficient.</p>
       <div className="field"><label>Government disbursement / ministry payment reference</label><input value={governmentRef} onChange={e=>setGovernmentRef(e.target.value)} placeholder="Official government transaction reference"/></div>
       <div className="field"><label>KASA bank remittance / deposit reference</label><input value={bankRef} onChange={e=>setBankRef(e.target.value)} placeholder="Confirmed bank receipt reference"/></div>
       <div className="field"><label>Actual amount received by KASA (ZMW)</label><input type="number" min="0.01" step="0.01" value={cdfAmount} onChange={e=>setCdfAmount(e.target.value)}/></div>
       <label className="required-toggle"><input type="checkbox" checked={cdfEnrollmentConfirmed} onChange={e=>setCdfEnrollmentConfirmed(e.target.checked)}/> I verified government remittance has cleared in KASA accounts and the student is actually enrolled.</label>
      </>)}
      {next==='payment_verified'&&(
       <>
        <label className="required-toggle"><input type="checkbox" checked={enrollmentConfirmed} onChange={e=>setEnrollmentConfirmed(e.target.checked)}/> I verified student enrollment and FULL payment recorded in the Finance ledger against the approved fee quote.</label>
        <div className="field"><label>Verified Payment Receipt Number</label><input value={paidRef} onChange={e=>setPaidRef(e.target.value)} placeholder="Receipt number"/></div>
        <div className="field"><label>Verified Amount Paid (ZMW)</label><input type="number" min="0.01" step="0.01" value={paidAmount} onChange={e=>setPaidAmount(e.target.value)}/></div>
       </>
      )}

      {['cdf_funds_received','payment_verified'].includes(next)&&selected.agentId&&selected.formKind==='student'&&(
       <label className="required-toggle"><input type="checkbox" checked={referralVerified} onChange={e=>setReferralVerified(e.target.checked)}/> Independently verify original agent attribution before awarding commission</label>
      )}

      {next==='commission_paid'&&(
       <div className="field"><label>Commission Transfer Reference</label><input value={payRef} onChange={e=>setPayRef(e.target.value)} placeholder="Transfer reference"/></div>
      )}

      <div className="field">
       <label>Reviewer Note (optional)</label>
       <textarea rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Add internal review details..."/>
      </div>

      <button className="btn btn-primary btn-full" disabled={!next||busy} onClick={()=>void updateStatus()}>
       {busy?'Updating…':'Confirm Status Change'}
      </button>
     </div>
    )}

    {['super_admin','admin'].includes(role)&&(
     <div className="panel pad-panel">
      <h2 style={{color:'#ef4444'}}>Danger Zone</h2>
      <p className="muted">Permanently delete this application record from the KASA system.</p>
      <button type="button" className="btn btn-outline" style={{width:'100%',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',marginTop:16,display:'flex',alignItems:'center',justifyContent:'center',gap:8}} disabled={busy} onClick={()=>setConfirmingDelete(true)}>
       <Trash2 size={16}/> Delete Application Permanently
      </button>
     </div>
    )}
   </aside>
  </div>

  <ConfirmModal
   isOpen={confirmingDelete}
   title="Delete Application Permanently"
   message={`Are you sure you want to permanently delete application "${selected.reference}"? This action cannot be undone.`}
   kind="danger"
   confirmLabel="Delete Application"
   cancelLabel="Cancel"
   busy={busy}
   onConfirm={()=>void deleteAppPermanently()}
   onCancel={()=>setConfirmingDelete(false)}
  />
 </div>;
}
