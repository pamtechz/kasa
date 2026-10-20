'use client';

import {useEffect, useState} from 'react';
import {StudentPortal} from '@/components/StudentPortal';
import {
  ClipboardList, CheckCircle2, Download, FileText, Share2, Wallet,
  RefreshCw, Trash2, Edit, AlertCircle, FileDown, LockKeyhole
} from 'lucide-react';
import {authHeaders} from '@/lib/firebase-client';
import {StatusBadge} from '@/components/Portal';
import Link from 'next/link';

type ApplicantItem = {
  id: string;
  reference: string;
  formTitle: string;
  status: string;
  submittedAt: string;
  fundingMethod: string | null;
  downloadToken?: string | null;
};

export default function StudentDashboardPage() {
  const [items, setItems] = useState<ApplicantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadApplications = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/student/applications', {headers, cache: 'no-store'});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load student applications.');
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

  return (
    <StudentPortal>
      <div className="page-heading">
        <div>
          <h1>My Applications & Admission Offers</h1>
          <p>View your submitted KASA applications, verify CDF sponsorship status, and download your official Acceptance Letter Pack and Enrollment Form.</p>
        </div>
        <button className="btn btn-outline" onClick={() => void loadApplications()} disabled={loading} style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="alert-error" style={{marginBottom: 16}}>{error}</div>}

      {/* Summary Cards */}
      <div className="metric-grid" style={{marginBottom: 24}}>
        <div className="metric-card">
          <div className="metric-icon blue"><ClipboardList /></div>
          <span>Total Applications</span>
          <strong>{loading ? '—' : items.length}</strong>
          <small>Submitted in system</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon green"><CheckCircle2 /></div>
          <span>Admission Status</span>
          <strong>{loading ? '—' : items.some(a => ['accepted','letter_issued','cdf_submitted','cdf_approved','payment_verified'].includes(a.status)) ? 'OFFER ISSUED' : 'UNDER REVIEW'}</strong>
          <small>CDF Sponsorship & Enrollment</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon purple"><FileText /></div>
          <span>Official Documents</span>
          <strong>{loading ? '—' : items.length * 2}</strong>
          <small>Acceptance & Enrollment PDFs</small>
        </div>
      </div>

      {/* Student Applications Table */}
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>My Application Records</h2>
            <p>Official records linked to your verified student account.</p>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Programme / Course</th>
                <th>Submitted Date</th>
                <th>Status</th>
                <th>Funding Pathway</th>
                <th>Official PDF Downloads</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="empty-state">Loading your applications…</td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No application records linked to your account yet. <Link href="/programmes" className="text-link">Explore programmes</Link> to apply.
                  </td>
                </tr>
              ) : (
                items.map(a => {
                  const isAccepted = ['accepted', 'letter_issued', 'cdf_submitted', 'cdf_approved', 'payment_verified', 'commission_paid'].includes(a.status);
                  const tokenQuery = a.downloadToken ? `?token=${encodeURIComponent(a.downloadToken)}` : '';
                  const letterUrl = `/api/public/submissions/${a.id}/letter${tokenQuery}`;
                  const formUrl = `/api/public/submissions/${a.id}/enrollment-form${tokenQuery}`;

                  return (
                    <tr key={a.id}>
                      <td><strong>{a.reference}</strong></td>
                      <td>{a.formTitle}</td>
                      <td>{new Date(a.submittedAt).toLocaleDateString('en-GB')}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        {a.fundingMethod === 'cdf' ? 'CDF sponsorship' : a.fundingMethod === 'self_funded' ? 'Self-funded' : 'Pending verification'}
                      </td>
                      <td>
                        <div style={{display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap'}}>
                          {isAccepted && (
                            <a
                              href={letterUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-outline"
                              style={{padding: '5px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--green)', borderColor: 'var(--green)'}}
                            >
                              <Download size={14} /> Acceptance Letter
                            </a>
                          )}
                          <a
                            href={formUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline"
                            style={{padding: '5px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6}}
                          >
                            <FileText size={14} /> Enrollment Form
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </StudentPortal>
  );
}
