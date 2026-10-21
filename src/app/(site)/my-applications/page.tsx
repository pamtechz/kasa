'use client';

import {useState, useEffect} from 'react';
import Link from 'next/link';
import {StudentPortal} from '@/components/StudentPortal';
import {
  ClipboardList, CheckCircle2, Download, FileText, Share2, Wallet,
  RefreshCw, ShieldCheck, FileDown, ArrowRight, User, Bell, AlertCircle, LogIn
} from 'lucide-react';
import {authHeaders, firebaseConfigured, auth} from '@/lib/firebase-client';
import {onAuthStateChanged} from 'firebase/auth';
import {StatusBadge} from '@/components/Portal';

type ApplicantItem = {
  id: string;
  reference: string;
  formTitle: string;
  status: string;
  submittedAt: string;
  fundingMethod: string | null;
  downloadToken?: string | null;
};

type SessionState = 'checking' | 'guest' | 'ready' | 'unavailable';

export default function MyApplicationsPage() {
  const [items, setItems] = useState<ApplicantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<SessionState>('checking');

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
    if (!firebaseConfigured || !auth) {
      setStatus('unavailable');
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) {
        setStatus('guest');
        return;
      }
      setStatus('ready');
      void loadApplications();
    });
    return () => unsubscribe();
  }, []);

  return (
    <StudentPortal>
      {status==='checking' && (
        <section className="panel pad-panel" role="status">
          <p>Checking your secure student session…</p>
        </section>
      )}

      {status==='unavailable' && (
        <section className="panel pad-panel" role="alert">
          <AlertCircle size={26} />
          <h2>Student sign-in is unavailable</h2>
          <p>Firebase Authentication has not been initialized for this deployment.</p>
          <Link className="btn btn-primary" href="/login?next=%2Fmy-applications">
            <LogIn size={16} /> Sign in
          </Link>
        </section>
      )}

      {status==='guest' && (
        <section className="panel pad-panel">
          <ShieldCheck size={28} />
          <h2>Sign in to view your applications</h2>
          <p>Only applications belonging to your verified email address are visible in your student portal.</p>
          <Link className="btn btn-primary" href="/login?next=%2Fmy-applications">
            <LogIn size={16} /> Sign in or create an account
          </Link>
        </section>
      )}

      {status==='ready' && (
        <>
          <div className="page-heading">
            <div>
              <h1>Student Portal Overview</h1>
              <p>Track your submitted KASA applications, verify CDF sponsorship status, download official PDF admission packs, and earn student referral rewards.</p>
            </div>
            <button className="btn btn-outline" onClick={() => void loadApplications()} disabled={loading} style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
              <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>

          {error && <div className="alert-error" style={{marginBottom: 16}}>{error}</div>}

          {/* Summary Metrics Row */}
          <div className="metric-grid" style={{marginBottom: 24}}>
            <div className="metric-card">
              <div className="metric-icon blue"><ClipboardList /></div>
              <span>My Applications</span>
              <strong>{loading ? '—' : items.length}</strong>
              <small>Submitted in system</small>
            </div>
            <div className="metric-card">
              <div className="metric-icon green"><CheckCircle2 /></div>
              <span>Admission Status</span>
              <strong>{loading ? '—' : items.some(a => ['accepted','letter_issued','cdf_submitted','cdf_approved','payment_verified'].includes(a.status)) ? 'OFFER ISSUED' : 'UNDER REVIEW'}</strong>
              <small>CDF Sponsorship & Enrolment</small>
            </div>
            <div className="metric-card">
              <div className="metric-icon purple"><Share2 /></div>
              <span>Refer & Earn</span>
              <strong>ZMW 300.00</strong>
              <small>Per verified student referral</small>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24}}>
            <Link href="/student-portal/applications" className="panel pad-panel" style={{textDecoration: 'none', color: 'inherit', borderLeft: '4px solid var(--green)'}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
                <h3 style={{margin: 0, fontSize: 16}}>My Applications & Documents</h3>
                <ArrowRight size={18} style={{color: 'var(--green)'}} />
              </div>
              <p className="muted" style={{fontSize: 13, margin: 0}}>
                View application progress, upload NRC/qualifications, and download official PDF Acceptance Letters.
              </p>
            </Link>

            <Link href="/student-portal/referrals" className="panel pad-panel" style={{textDecoration: 'none', color: 'inherit', borderLeft: '4px solid var(--gold)'}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
                <h3 style={{margin: 0, fontSize: 16}}>Refer & Earn Program</h3>
                <ArrowRight size={18} style={{color: 'var(--gold)'}} />
              </div>
              <p className="muted" style={{fontSize: 13, margin: 0}}>
                Get your unique referral link, invite friends, and track your earned commission rewards.
              </p>
            </Link>
          </div>

          {/* Applications Table */}
          <div className="panel">
            <div className="panel-title">
              <div>
                <h2>Recent Applications</h2>
                <p>Official records linked to your verified student account.</p>
              </div>
              <Link href="/student-portal/applications" className="btn btn-outline btn-sm">
                View All Applications →
              </Link>
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
        </>
      )}
    </StudentPortal>
  );
}
