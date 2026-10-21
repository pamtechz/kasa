'use client';

import {useState, useEffect} from 'react';
import Link from 'next/link';
import {StudentPortal} from '@/components/StudentPortal';
import {
  ClipboardList, CheckCircle2, Download, FileText, UploadCloud,
  FileCheck, Clock, ShieldCheck, RefreshCw, AlertCircle
} from 'lucide-react';
import {authHeaders} from '@/lib/firebase-client';
import {StatusBadge} from '@/components/Portal';

type ApplicantItem = {
  id: string;
  reference: string;
  formTitle: string;
  status: string;
  submittedAt: string;
  fundingMethod: string | null;
  downloadToken?: string | null;
  documents?: Record<string, {fileName: string; url: string; uploadedAt: string; verifiedAt?: string}>;
};

export default function StudentApplicationsPage() {
  const [items, setItems] = useState<ApplicantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState(false);
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

  async function uploadDocument(submissionId: string, kind: string, file?: File) {
    if (!file) return;
    setUploadingDoc(true);
    setError('');
    setMessage('');
    try {
      const headers = await authHeaders();
      const body = new FormData();
      body.append('kind', kind);
      body.append('file', file);
      const res = await fetch(`/api/admin/submissions/${submissionId}/documents`, {
        method: 'POST',
        headers,
        body
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Document upload failed.');
      setMessage('Document uploaded successfully and queued for admissions review.');
      await loadApplications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingDoc(false);
    }
  }

  return (
    <StudentPortal>
      <div className="page-heading">
        <div>
          <h1>Student Applications & Document Verification</h1>
          <p>Review your submitted applications, upload required CDF/admissions verification documents, and download official PDF admission packs.</p>
        </div>
        <button className="btn btn-outline" onClick={() => void loadApplications()} disabled={loading} style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="alert-error" style={{marginBottom: 16}}>{error}</div>}
      {message && <div className="notice" style={{marginBottom: 16}}><CheckCircle2 size={16} /> {message}</div>}

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
            const isAccepted = ['accepted', 'letter_issued', 'cdf_submitted', 'cdf_approved', 'payment_verified', 'commission_paid'].includes(app.status);
            const tokenQuery = app.downloadToken ? `?token=${encodeURIComponent(app.downloadToken)}` : '';
            const letterUrl = `/api/public/submissions/${app.id}/letter${tokenQuery}`;
            const formUrl = `/api/public/submissions/${app.id}/enrollment-form${tokenQuery}`;

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
                  {isAccepted && (
                    <a
                      href={letterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline"
                      style={{padding: '6px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--green)', borderColor: 'var(--green)'}}
                    >
                      <Download size={15} /> Download Official Acceptance Letter (PDF)
                    </a>
                  )}
                  <a
                    href={formUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                    style={{padding: '6px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6}}
                  >
                    <FileText size={15} /> Download Completed Enrollment Form (PDF)
                  </a>
                </div>

                {/* Upload Verification Documents */}
                <div style={{background: '#ffffff', border: '1px solid var(--border)', borderRadius: 10, padding: 16}}>
                  <h3 style={{fontSize: 15, margin: '0 0 8px', display: 'inline-flex', alignItems: 'center', gap: 6}}>
                    <UploadCloud size={18} style={{color: 'var(--green)'}} /> Required Document Uploads
                  </h3>
                  <p className="muted" style={{fontSize: 12, margin: '0 0 16px'}}>
                    Upload copies of your NRC/ID, Grade 9/12 Certificate, and WDC/CDF Recommendation Form for verification.
                  </p>

                  <div className="form-grid">
                    {[
                      {id: 'nrc_copy', label: '1. NRC / National ID Copy'},
                      {id: 'results_slip', label: '2. School Results / Grade 12 Certificate'},
                      {id: 'cdf_form', label: '3. WDC / CDF Recommendation Form'}
                    ].map(doc => {
                      const uploaded = app.documents?.[doc.id];
                      return (
                        <div key={doc.id} className="field" style={{background: '#f8faf9', padding: 12, borderRadius: 8, border: '1px solid var(--border)'}}>
                          <label style={{fontSize: 12, fontWeight: 700, marginBottom: 4}}>{doc.label}</label>
                          {uploaded ? (
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, marginTop: 4}}>
                              <span style={{color: 'var(--green)', fontWeight: 600}}>
                                ✓ {uploaded.fileName} {uploaded.verifiedAt ? '(Verified)' : '(Awaiting Review)'}
                              </span>
                              <a href={uploaded.url} target="_blank" rel="noopener noreferrer" className="text-link" style={{fontSize: 11}}>
                                View
                              </a>
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
