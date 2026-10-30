'use client';

import {useState, useEffect} from 'react';
import Link from 'next/link';
import {StudentPortal} from '@/components/StudentPortal';
import {
  ClipboardList, CheckCircle2, Download, FileText, UploadCloud,
  FileCheck, Clock, ShieldCheck, RefreshCw, AlertCircle
} from 'lucide-react';
import {authHeaders,appCheckToken} from '@/lib/firebase-client';
import {ExternalStorageConnection} from '@/components/ExternalStorageConnection';
import {uploadCdfDocumentDirect} from '@/lib/r2-upload-client';
import {StatusBadge} from '@/components/Portal';
import {downloadStudentPdf} from '@/lib/student-document-download';

type ApplicantItem = {
  id: string;
  reference: string;
  formTitle: string;
  status: string;
  submittedAt: string;
  fundingMethod: string | null;
  documents?: Record<string, {fileName: string; url: string; uploadedAt: string; verifiedAt?: string}>;
};

export default function StudentPortalApplicationsPage() {
  const [items, setItems] = useState<ApplicantItem[]>([]);
  const [requiredDocuments,setRequiredDocuments]=useState<{id:string;label:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [claimReference,setClaimReference]=useState('');
  const [claimToken,setClaimToken]=useState('');
  const [claimBusy,setClaimBusy]=useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadApplications = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/student/applications', {headers, cache: 'no-store'});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load applications.');
      setItems(Array.isArray(data.applications) ? data.applications : []);
      setRequiredDocuments(Array.isArray(data.requiredDocuments) ? data.requiredDocuments : []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApplications();
  }, []);

  async function claimExistingApplication(event:React.FormEvent){
    event.preventDefault();
    setClaimBusy(true);setMessage('');setError('');
    try{
      const headers:Record<string,string>={...(await authHeaders()),'Content-Type':'application/json'};
      const check=await appCheckToken();
      if(check)headers['x-firebase-appcheck']=check;
      const response=await fetch('/api/student/applications',{
        method:'POST',headers,
        body:JSON.stringify({reference:claimReference.trim(),downloadToken:claimToken.trim()})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Application could not be linked.');
      setClaimReference('');setClaimToken('');
      await loadApplications();
      setMessage('Your application was securely linked to your verified student account.');
    }catch(err){setError(err instanceof Error?err.message:'Application could not be linked.');}
    finally{setClaimBusy(false);}
  }

  async function uploadDocument(submissionId: string, kind: string, file?: File) {
    if (!file) return;
    setUploadingDoc(true);
    setError('');
    setMessage('');
    try {
      await uploadCdfDocumentDirect(file,submissionId,kind);
      setMessage('Document uploaded successfully and queued for admissions review.');
      await loadApplications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingDoc(false);
    }
  }

  async function viewDocument(submissionId:string,kind:string){
    setError('');
    try{
      const headers=await authHeaders();
      const res=await fetch(
        `/api/student/applications/${encodeURIComponent(submissionId)}/documents?kind=${encodeURIComponent(kind)}`,
        {headers,cache:'no-store'}
      );
      const data=await res.json();
      if(!res.ok||typeof data.url!=='string')throw new Error(data.error||'Unable to open the document.');
      window.location.assign(data.url);
    }catch(err){setError(err instanceof Error?err.message:'Document unavailable.');}
  }

  async function handleDownload(id:string,kind:'letter'|'enrollment-form',reference:string){
    setError('');
    try{await downloadStudentPdf(id,kind,reference);}
    catch(err){setError(err instanceof Error?err.message:'Unable to download document.');}
  }

  return (
    <StudentPortal><ExternalStorageConnection/>
      <div className="page-heading">
        <div>
          <h1>Student Applications & Verification Documents</h1>
          <p>Review your submitted applications, upload required CDF/admissions verification documents, and download official PDF admission packs.</p>
        </div>
        <button className="btn btn-outline" onClick={() => void loadApplications()} disabled={loading} style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="alert-error" style={{marginBottom: 16}}>{error}</div>}
      {message && <div className="notice" style={{marginBottom: 16}}><CheckCircle2 size={16} /> {message}</div>}

      <section className="panel pad-panel" aria-label="Claim existing application" style={{marginBottom:20}}>
        <h2 style={{fontSize:18,marginBottom:6}}>Claim an existing application</h2>
        <p className="muted" style={{fontSize:13}}>
          If you applied without signing in, link the application to your verified account using its reference and
          the private 64-character download token issued on your submission receipt. An email address alone cannot establish ownership.
        </p>
        <form onSubmit={event=>void claimExistingApplication(event)} className="form-grid">
          <div className="field">
            <label htmlFor="claim-reference">Application reference</label>
            <input id="claim-reference" required maxLength={40} value={claimReference}
              placeholder="KASA-2027-XXXXXXXX" onChange={event=>setClaimReference(event.target.value)}/>
          </div>
          <div className="field">
            <label htmlFor="claim-token">Private application token</label>
            <input id="claim-token" required minLength={64} maxLength={64} autoComplete="off"
              type="password" value={claimToken} onChange={event=>setClaimToken(event.target.value)}/>
          </div>
          <div className="field full">
            <button type="submit" className="btn btn-primary" disabled={claimBusy||!claimReference.trim()||claimToken.trim().length!==64}>
              {claimBusy?'Linking…':'Securely link application'}
            </button>
          </div>
        </form>
      </section>

      <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
        {loading ? (
          <div className="panel pad-panel" style={{textAlign: 'center', padding: 40}}>
            Loading your applications…
          </div>
        ) : items.length === 0 ? (
          <div className="panel pad-panel empty-state" style={{textAlign: 'center', padding: 40}}>
            <ClipboardList size={36} style={{color: 'var(--muted)', opacity: 0.5, marginBottom: 8}} />
            <p style={{margin: 0, fontWeight: 600}}>No application records linked to your account yet.</p>
            <small className="muted">Apply through the public site to start an application.</small>
          </div>
        ) : (
          items.map(app => {
            const isAccepted = ['letter_issued', 'cdf_submitted', 'cdf_approved','cdf_funds_received', 'payment_verified', 'commission_paid'].includes(app.status);

            return (
              <div key={app.id} className="panel pad-panel" style={{borderLeft: '4px solid var(--green, #103f2c)'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12}}>
                  <div>
                    <span className="overline" style={{color: 'var(--green)', margin: 0}}>APPLICATION RECORD</span>
                    <h2 style={{fontSize: 20, margin: '2px 0 4px'}}>{app.reference} — {app.formTitle}</h2>
                    <span className="muted" style={{fontSize: 12}}>
                      Submitted Date: {new Date(app.submittedAt).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'})}
                    </span>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                    <StatusBadge status={app.status} />
                  </div>
                </div>

                {/* PDF Downloads Bar */}
                <div style={{background: '#f8faf9', padding: 14, borderRadius: 10, border: '1px solid var(--border)', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center'}}>
                  <strong style={{fontSize: 13, color: 'var(--ink)'}}>Official Documents:</strong>
                  {app.status==='accepted'&&<span className="muted">Admission accepted. The official offer is still being prepared by KASA and is not yet available.</span>}
                  {isAccepted && (
                    <button type="button" onClick={()=>void handleDownload(app.id,'letter',app.reference)} className="btn btn-outline"
                      style={{padding: '6px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--green)', borderColor: 'var(--green)'}}
                    >
                      <Download size={15} /> Download Official Acceptance Letter (PDF)
                    </button>
                  )}
                  <button type="button" onClick={()=>void handleDownload(app.id,'enrollment-form',app.reference)} className="btn btn-outline"
                    style={{padding: '6px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6}}
                  >
                    <FileText size={15} /> Download Completed Enrollment Form (PDF)
                  </button>
                </div>

                {/* Upload Verification Documents */}
                <div style={{background: '#ffffff', border: '1px solid var(--border)', borderRadius: 10, padding: 16}}>
                  <h3 style={{fontSize: 15, margin: '0 0 8px', display: 'inline-flex', alignItems: 'center', gap: 6}}>
                    <UploadCloud size={18} style={{color: 'var(--green)'}} /> Required Document Uploads
                  </h3>
                  <p className="muted" style={{fontSize: 12, margin: '0 0 16px'}}>
                    Upload the documents required for your application. Files remain unverified until an admissions reviewer checks the originals.
                  </p>

                  {requiredDocuments.length===0 && <p className="muted">No document requirements are currently configured for this intake.</p>}
                  <div className="form-grid">
                    {requiredDocuments.map(doc => {
                      const uploaded = app.documents?.[doc.id];
                      return (
                        <div key={doc.id} className="field" style={{background: '#f8faf9', padding: 12, borderRadius: 8, border: '1px solid var(--border)'}}>
                          <label style={{fontSize: 12, fontWeight: 700, marginBottom: 4}}>{doc.label}</label>
                          {uploaded ? (
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, marginTop: 4}}>
                              <span style={{color: 'var(--green)', fontWeight: 600}}>
                                ✓ {uploaded.fileName} {uploaded.verifiedAt ? '(Verified)' : '(Awaiting Review)'}
                              </span>
                              <button type="button" className="text-link"
                                onClick={()=>void viewDocument(app.id,doc.id)} style={{fontSize:11}}>
                                View
                              </button>
                            </div>
                          ) : (
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              disabled={uploadingDoc}
                              onChange={e => e.target.files?.[0] && void uploadDocument(app.id, doc.id, e.target.files[0])}
                              style={{fontSize: 12}}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </StudentPortal>
  );
}
