'use client';
import {useEffect, useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {
  AlertCircle, LogIn, LogOut, RefreshCw, ShieldCheck, Copy, Download,
  FileText, Share2, Users, Wallet, Coins, User, Plus, Trash2, ArrowLeft,
  X, Save, CheckCircle2, ExternalLink, Sparkles, Phone, MessageSquare
} from 'lucide-react';
import {SiteChrome, PageIntro} from '@/components/SiteChrome';
import {ConfirmModal} from '@/components/ConfirmModal';
import {auth, authHeaders, appCheckToken, firebaseConfigured, signOutClient} from '@/lib/firebase-client';
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

type ReferralItem = {
  id: string;
  reference: string;
  candidateName: string;
  programme: string;
  status: string;
  fundingMethod?: string;
  commissionEarned: number;
  submittedAt: string;
};

type ReferralData = {
  agentCode: string;
  referralLink: string;
  referralsCount: number;
  successfulCount: number;
  totalEarned: number;
  currency: string;
  cdfRate: number;
  paidRate: number;
  referrals: ReferralItem[];
};

const defaultProgrammes = [
  'General Agriculture (TEVETA Level II)',
  'Commercial Agribusiness & Irrigation Systems',
  'Heavy Equipment Operations & Plant Maintenance',
  'Automotive Mechanics & Heavy Vehicle Repair',
  'Industrial Electrical & Solar Systems Installation',
  'Construction & Bricklaying Technology',
  'Metal Fabrication & Arc Welding',
  'Carpentry & Joinery',
  'Information & Communications Technology'
];

export default function MyApplications() {
  const [email, setEmail] = useState('');
  const [items, setItems] = useState<ApplicantItem[]>([]);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<SessionState>('checking');
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [activeTab, setActiveTab] = useState<'applications' | 'referrals'>('applications');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const router = useRouter();

  // Application editing modal state
  const [editingApp, setEditingApp] = useState<ApplicantItem | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Student direct referral modal state
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [withdrawalTarget, setWithdrawalTarget] = useState<{id: string; ref: string; type: 'app' | 'ref'} | null>(null);
  const [candName, setCandName] = useState('');
  const [candPhone, setCandPhone] = useState('');
  const [candEmail, setCandEmail] = useState('');
  const [candNrc, setCandNrc] = useState('');
  const [candProg, setCandProg] = useState(defaultProgrammes[0]);
  const [candFunding, setCandFunding] = useState<'cdf' | 'self_funded'>('cdf');
  const [candDistrict, setCandDistrict] = useState('');
  const [candNote, setCandNote] = useState('');
  const [registerBusy, setRegisterBusy] = useState(false);

  async function load() {
    setLoadingItems(true);
    setLoadingReferrals(true);
    try {
      const headers = await authHeaders();
      const [appRes, refRes] = await Promise.all([
        fetch('/api/student/applications', {headers, cache: 'no-store'}),
        fetch('/api/student/referrals', {headers, cache: 'no-store'}).catch(() => null)
      ]);

      const appData = await appRes.json();
      if (!appRes.ok) throw Error(appData.error || 'Unable to load applications.');
      setItems(Array.isArray(appData.applications) ? appData.applications : []);
      if (typeof appData.email === 'string') setEmail(appData.email);

      if (refRes && refRes.ok) {
        const refData = await refRes.json().catch(() => null);
        if (refData && refData.agentCode) {
          setReferralData(refData);
        }
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load applications.');
    } finally {
      setLoadingItems(false);
      setLoadingReferrals(false);
    }
  }

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setStatus('unavailable');
      return;
    }
    let live = true;
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!live) return;
      if (!user) {
        setEmail('');
        setItems([]);
        setStatus('guest');
        return;
      }
      if (!user.emailVerified) {
        setError('Verify your email address before viewing private applications.');
        setStatus('guest');
        return;
      }
      setEmail(user.email || '');
      setStatus('ready');
      void load();
    }, () => {
      if (live) {
        setStatus('unavailable');
        setError('Unable to check your login session. Try refreshing this page.');
      }
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  async function logout() {
    setBusy(true);
    setError('');
    try {
      await signOutClient();
      setEmail('');
      setItems([]);
      setStatus('guest');
      router.replace('/login?next=%2Fmy-applications');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    if (status !== 'ready') return;
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const headers = await authHeaders();
      const token = await appCheckToken();
      const res = await fetch('/api/student/applications', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          ...(token ? {'X-Firebase-AppCheck': token} : {})
        },
        body: JSON.stringify({reference: reference.trim().toUpperCase()})
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || 'Unable to link your application.');
      setReference('');
      setMessage('Your application is now linked to this verified account.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to link application.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmWithdrawal() {
    if (!withdrawalTarget) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const headers = await authHeaders();
      const endpoint = withdrawalTarget.type === 'app' ? `/api/student/applications?id=${withdrawalTarget.id}` : `/api/student/referrals?id=${withdrawalTarget.id}`;
      const res = await fetch(endpoint, {method: 'DELETE', headers});
      const data = await res.json();
      if (!res.ok) throw Error(data.error || 'Failed to withdraw record.');
      setMessage(`${withdrawalTarget.type === 'app' ? 'Application' : 'Referral'} ${withdrawalTarget.ref} has been withdrawn.`);
      setWithdrawalTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to withdraw record.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEditApp(e: React.FormEvent) {
    e.preventDefault();
    if (!editingApp) return;
    setSavingEdit(true);
    setError('');
    setMessage('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/student/applications', {
        method: 'PATCH',
        headers: {...headers, 'Content-Type': 'application/json'},
        body: JSON.stringify({id: editingApp.id, phone: editPhone, applicantNote: editNote})
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || 'Failed to update application.');
      setMessage(`Updated contact details for application ${editingApp.reference}`);
      setEditingApp(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update application.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleCopyLink() {
    if (!referralData?.referralLink) return;
    try {
      await navigator.clipboard.writeText(referralData.referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setError('Unable to copy to clipboard.');
    }
  }

  async function handleCopyCode() {
    if (!referralData?.agentCode) return;
    try {
      await navigator.clipboard.writeText(referralData.agentCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      setError('Unable to copy code.');
    }
  }

  function handleShareWhatsApp() {
    if (!referralData?.referralLink) return;
    const text = `Join me at KASA (Kafue Agri-Sport Academy)! Apply for 2027 enrollment in Agriculture, Sports and Technical Trades here: ${referralData.referralLink}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }

  async function handleRegisterCandidate(e: React.FormEvent) {
    e.preventDefault();
    if (!candName.trim() || !candPhone.trim() || !candProg.trim()) return;
    setRegisterBusy(true);
    setError('');
    setMessage('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/student/referrals', {
        method: 'POST',
        headers: {...headers, 'Content-Type': 'application/json'},
        body: JSON.stringify({
          candidateName: candName.trim(),
          phone: candPhone.trim(),
          email: candEmail.trim(),
          nrc: candNrc.trim(),
          programme: candProg,
          fundingMethod: candFunding,
          district: candDistrict.trim(),
          note: candNote.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || 'Failed to register referral.');
      setMessage(`Candidate ${candName} registered successfully with reference ${data.reference}!`);
      setRegisterModalOpen(false);
      setCandName('');
      setCandPhone('');
      setCandEmail('');
      setCandNrc('');
      setCandDistrict('');
      setCandNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register candidate referral.');
    } finally {
      setRegisterBusy(false);
    }
  }

  function withdraw(id: string, ref: string) {
    setWithdrawalTarget({id, ref, type: 'app'});
  }

  function withdrawDirectReferral(ref: ReferralItem) {
    setWithdrawalTarget({id: ref.id, ref: ref.reference, type: 'ref'});
  }

  return (
    <SiteChrome>
      <PageIntro
        eyebrow="PRIVATE STUDENT PORTAL"
        title="Student admissions & referrals"
        description="Track your KASA applications, download official acceptance documents, and share your referral link to earn student rewards."
      />
      <main className="container site-content">
        {status==='checking' && (
          <section className="panel pad-panel" role="status">
            <p>Checking your secure session…</p>
          </section>
        )}

        {status==='unavailable' && (
          <section className="panel pad-panel" role="alert">
            <AlertCircle size={26} />
            <h2>Student sign-in is unavailable</h2>
            <p>Firebase Authentication has not been initialized for this deployment, or your session could not be checked. No private records have been loaded.</p>
            {error && <p className="alert-error">{error}</p>}
            <div className="inline-form">
              <Link className="btn btn-primary" href="/login?next=%2Fmy-applications">
                <LogIn size={16} /> Sign in
              </Link>
              <button className="btn btn-outline" type="button" onClick={() => window.location.reload()}>
                <RefreshCw size={16} /> Retry
              </button>
            </div>
          </section>
        )}

        {status==='guest' && (
          <section className="panel pad-panel">
            <ShieldCheck size={28} />
            <h2>Sign in to view your applications</h2>
            <p>Only applications belonging to your verified email address are visible. You can also link an older application using its reference after signing in.</p>
            {error && <p className="alert-error">{error}</p>}
            <Link className="btn btn-primary" href="/login?next=%2Fmy-applications">
              <LogIn size={16} /> Sign in or create an account
            </Link>
          </section>
        )}

        {status==='ready' && (
          <>
            {/* Account Bar */}
            <section className="panel pad-panel" style={{marginBottom: 16}}>
              <div className="student-account-row">
                <div>
                  <h2>Student workspace</h2>
                  <p>
                    Verified email: <strong>{email}</strong>
                    {referralData?.agentCode && (
                      <span style={{marginLeft: 12, fontSize: 13, color: 'var(--green)', fontWeight: 700}}>
                        · Referral Code: {referralData.agentCode}
                      </span>
                    )}
                  </p>
                </div>
                <div style={{display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap'}}>
                  <Link href="/programmes" className="btn btn-primary">
                    <Plus size={16} /> Apply for a programme
                  </Link>
                  <Link href="/account" className="btn btn-secondary">
                    <User size={16} /> Manage account
                  </Link>
                  <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void logout()}>
                    <LogOut size={17} /> Sign out
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div style={{display: 'flex', gap: 10, marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16}}>
                <button
                  type="button"
                  className={`btn ${activeTab === 'applications' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setActiveTab('applications')}
                  style={{display: 'inline-flex', alignItems: 'center', gap: 8}}
                >
                  <FileText size={16} /> My applications ({items.length})
                </button>
                <button
                  type="button"
                  className={`btn ${activeTab === 'referrals' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setActiveTab('referrals')}
                  style={{display: 'inline-flex', alignItems: 'center', gap: 8}}
                >
                  <Coins size={16} /> Referral rewards & link
                  {referralData && referralData.totalEarned > 0 && (
                    <span style={{background: 'var(--gold)', color: '#19382c', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800}}>
                      K{referralData.totalEarned.toFixed(0)}
                    </span>
                  )}
                </button>
              </div>
            </section>

            {error && <div className="alert-error" role="alert" style={{marginBottom: 16}}>{error}</div>}
            {message && <div className="notice" role="status" style={{marginBottom: 16}}>{message}</div>}

            {/* TAB 1: APPLICATIONS */}
            {activeTab === 'applications' && (
              <>
                <section className="panel pad-panel" style={{marginBottom: 16}}>
                  <h2>Link an existing application</h2>
                  <p>Enter the reference on your submission receipt. The application email must match your verified sign-in email.</p>
                  <div className="inline-form">
                    <input
                      aria-label="KASA application reference"
                      value={reference}
                      onChange={e => setReference(e.target.value)}
                      placeholder="KASA-2026-1234ABCD"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      disabled={busy || !reference.trim()}
                      className="btn btn-primary"
                      onClick={() => void claim()}
                    >
                      {busy ? 'Verifying…' : 'Link application'}
                    </button>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>Enrollment status</h2>
                      <p>Your verified admissions applications, review decisions, and official downloadable acceptance packs.</p>
                    </div>
                    <Link className="text-link" href="/admissions">
                      Admissions information
                    </Link>
                  </div>

                  {loadingItems ? (
                    <p className="empty-state" role="status">Loading your applications…</p>
                  ) : items.length === 0 ? (
                    <div className="empty-state">
                      <p>No applications are linked to this account yet.</p>
                      <Link className="btn btn-outline" href="/programmes">
                        Explore available programmes & apply
                      </Link>
                    </div>
                  ) : (
                    <div className="table-scroll" tabIndex={0} aria-label="My application records">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Reference</th>
                            <th>Programme</th>
                            <th>Submitted</th>
                            <th>Status</th>
                            <th>Funding</th>
                            <th>Official Documents</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(a => {
                            const isAccepted = ['accepted', 'letter_issued', 'cdf_submitted', 'cdf_approved', 'payment_verified', 'commission_paid'].includes(a.status);
                            const isPending = ['submitted', 'under_review', 'needs_information'].includes(a.status);
                            const letterUrl = `/api/public/submissions/${a.id}/letter${a.downloadToken ? `?token=${encodeURIComponent(a.downloadToken)}` : ''}`;
                            const formUrl = `/api/public/submissions/${a.id}/enrollment-form${a.downloadToken ? `?token=${encodeURIComponent(a.downloadToken)}` : ''}`;

                            return (
                              <tr key={a.id}>
                                <td>
                                  <strong>{a.reference}</strong>
                                </td>
                                <td>{a.formTitle}</td>
                                <td>{a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—'}</td>
                                <td>
                                  <StatusBadge status={a.status} />
                                </td>
                                <td>
                                  {a.fundingMethod === 'cdf'
                                    ? 'CDF sponsorship'
                                    : a.fundingMethod === 'self_funded'
                                    ? 'Self-funded'
                                    : 'Pending verification'}
                                </td>
                                <td>
                                  <div style={{display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center'}}>
                                    {isAccepted && (
                                      <a
                                        href={letterUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-outline"
                                        style={{padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--green)', borderColor: 'var(--green)'}}
                                        title="Download Official Acceptance Pack PDF"
                                      >
                                        <Download size={13} /> Acceptance letter
                                      </a>
                                    )}
                                    <a
                                      href={formUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn btn-outline"
                                      style={{padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5}}
                                      title="Download 9-Section Enrollment Form PDF"
                                    >
                                      <FileText size={13} /> Enrollment form
                                    </a>
                                  </div>
                                </td>
                                <td>
                                  {isPending ? (
                                    <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                                      <button
                                        type="button"
                                        className="text-link"
                                        onClick={() => {
                                          setEditingApp(a);
                                          setEditPhone('');
                                          setEditNote('');
                                        }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="text-link"
                                        style={{color: '#ef4444'}}
                                        onClick={() => void withdraw(a.id, a.reference)}
                                      >
                                        <Trash2 size={13} /> Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="muted">Processed</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}

            {/* TAB 2: REFERRAL PROGRAM & REWARDS */}
            {activeTab === 'referrals' && (
              <>
                {/* Metric Cards */}
                <div className="metric-grid" style={{marginBottom: 20}}>
                  <div className="metric-card">
                    <div className="metric-icon green">
                      <Users />
                    </div>
                    <span>Total invited candidates</span>
                    <strong>{loadingReferrals ? '—' : referralData?.referralsCount || 0}</strong>
                    <small>Candidates using your code</small>
                  </div>
                  <div className="metric-card">
                    <div className="metric-icon amber">
                      <CheckCircle2 />
                    </div>
                    <span>Successful enrollments</span>
                    <strong>{loadingReferrals ? '—' : referralData?.successfulCount || 0}</strong>
                    <small>CDF approved or tuition paid</small>
                  </div>
                  <div className="metric-card">
                    <div className="metric-icon green">
                      <Wallet />
                    </div>
                    <span>Total commission earned</span>
                    <strong>
                      {loadingReferrals ? '—' : `K${(referralData?.totalEarned || 0).toFixed(2)}`}
                    </strong>
                    <small>Earn ZMW on verified admissions</small>
                  </div>
                </div>

                {/* Share Link & Action Panel */}
                <section className="panel pad-panel" style={{marginBottom: 20}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 16}}>
                    <div>
                      <h2>Your student referral link & code</h2>
                      <p className="muted">
                        Share your unique link or code with colleagues, friends, or family applying for 2027 enrollment.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setRegisterModalOpen(true)}
                      style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
                    >
                      <Plus size={16} /> Register candidate directly
                    </button>
                  </div>

                  {referralData && (
                    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
                      {/* Code and Link Boxes */}
                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14}}>
                        <div style={{background: '#f4f8f5', border: '1px solid #d1e5d7', padding: '16px 20px', borderRadius: 12}}>
                          <span style={{fontSize: 12, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                            YOUR REFERRAL CODE
                          </span>
                          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8}}>
                            <span style={{fontSize: 22, fontWeight: 800, letterSpacing: '0.05em', color: '#13402d'}}>
                              {referralData.agentCode}
                            </span>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => void handleCopyCode()}
                              style={{padding: '6px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5}}
                            >
                              <Copy size={14} /> {copiedCode ? 'Copied!' : 'Copy Code'}
                            </button>
                          </div>
                        </div>

                        <div style={{background: '#fdfbf2', border: '1px solid #fae8b4', padding: '16px 20px', borderRadius: 12}}>
                          <span style={{fontSize: 12, fontWeight: 700, color: '#916a00', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                            EARNING RATES (ZMW)
                          </span>
                          <div style={{display: 'flex', gap: 16, marginTop: 8}}>
                            <div>
                              <strong style={{fontSize: 18, color: '#1a382b'}}>K{referralData.cdfRate}</strong>
                              <p style={{margin: 0, fontSize: 12, color: 'var(--muted)'}}>per CDF approval</p>
                            </div>
                            <div style={{borderLeft: '1px solid #fae8b4', paddingLeft: 16}}>
                              <strong style={{fontSize: 18, color: '#1a382b'}}>K{referralData.paidRate}</strong>
                              <p style={{margin: 0, fontSize: 12, color: 'var(--muted)'}}>per verified tuition</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Direct Link Share Row */}
                      <div className="inline-form" style={{alignItems: 'stretch'}}>
                        <input
                          readOnly
                          value={referralData.referralLink}
                          aria-label="Student Referral Link"
                          style={{flex: 1, minWidth: 260, background: '#fff', fontWeight: 500, fontSize: 14}}
                        />
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => void handleCopyLink()}
                          style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
                        >
                          <Copy size={16} /> {copiedLink ? 'Copied link!' : 'Copy link'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleShareWhatsApp}
                          style={{display: 'inline-flex', alignItems: 'center', gap: 6, background: '#25D366', color: '#fff', borderColor: '#25D366'}}
                        >
                          <Share2 size={16} /> WhatsApp
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                {/* Referred Candidates Table */}
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>Referred candidate records</h2>
                      <p>Applicants who submitted enrollment forms attributing your referral code.</p>
                    </div>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => void load()}
                      disabled={loadingReferrals}
                      style={{display: 'inline-flex', alignItems: 'center', gap: 5}}
                    >
                      <RefreshCw size={14} /> Refresh
                    </button>
                  </div>

                  {loadingReferrals ? (
                    <p className="empty-state" role="status">Loading referred candidates…</p>
                  ) : !referralData?.referrals || referralData.referrals.length === 0 ? (
                    <div className="empty-state">
                      <p>No candidates have applied with your code yet.</p>
                      <button type="button" className="btn btn-outline" onClick={() => void handleCopyLink()}>
                        Copy your link to share
                      </button>
                    </div>
                  ) : (
                    <div className="table-scroll" tabIndex={0} aria-label="Referred Candidates Table">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Reference</th>
                            <th>Candidate Name</th>
                            <th>Programme</th>
                            <th>Status</th>
                            <th>Funding</th>
                            <th>Commission Earned</th>
                            <th>Submitted</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {referralData.referrals.map(r => (
                            <tr key={r.id}>
                              <td>
                                <strong>{r.reference}</strong>
                              </td>
                              <td>{r.candidateName}</td>
                              <td>{r.programme}</td>
                              <td>
                                <StatusBadge status={r.status} />
                              </td>
                              <td>
                                {r.fundingMethod === 'cdf'
                                  ? 'CDF sponsorship'
                                  : r.fundingMethod === 'self_funded'
                                  ? 'Self-funded'
                                  : '—'}
                              </td>
                              <td>
                                {r.commissionEarned > 0 ? (
                                  <strong style={{color: 'var(--green)'}}>+K{r.commissionEarned.toFixed(2)}</strong>
                                ) : (
                                  <span className="muted">Pending qualification</span>
                                )}
                              </td>
                              <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—'}</td>
                              <td>
                                {r.status === 'submitted' ? (
                                  <button
                                    type="button"
                                    className="text-link"
                                    style={{color: '#ef4444'}}
                                    onClick={() => void withdrawDirectReferral(r)}
                                  >
                                    <Trash2 size={13} /> Withdraw
                                  </button>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}

        {/* Modal: Edit Application Details */}
        {editingApp && (
          <div className="modal-page-overlay" role="dialog" aria-modal="true">
            <div className="modal-page" style={{maxWidth: 620}}>
              <header className="modal-page-header">
                <div className="modal-page-header-left">
                  <span className="modal-page-badge">UPDATE CONTACT</span>
                  <h2>{editingApp.reference}</h2>
                </div>
                <div className="modal-page-header-right">
                  <button type="button" className="icon-btn" onClick={() => setEditingApp(null)} aria-label="Close">
                    <X size={20} />
                  </button>
                </div>
              </header>
              <form onSubmit={e => void saveEditApp(e)} style={{display: 'flex', flexDirection: 'column', flex: 1}}>
                <div className="modal-page-body">
                  <div className="modal-page-card">
                    <h3>Update Contact Details</h3>
                    <p>{editingApp.formTitle} · Update your contact phone number or leave a note for the admissions office.</p>
                    <div className="form-grid">
                      <div className="field full">
                        <label>Contact phone number</label>
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={e => setEditPhone(e.target.value)}
                          placeholder="E.g. +260 97X XXX XXX"
                        />
                      </div>
                      <div className="field full" style={{marginTop: 12}}>
                        <label>Note to admissions office</label>
                        <textarea
                          rows={3}
                          value={editNote}
                          onChange={e => setEditNote(e.target.value)}
                          placeholder="Provide any additional notes or changes to your contact address or sponsorship…"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <footer className="modal-page-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setEditingApp(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                    <Save size={16} /> {savingEdit ? 'Saving…' : 'Save changes'}
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Register a Candidate Referral Directly */}
        {registerModalOpen && (
          <div className="modal-page-overlay" role="dialog" aria-modal="true">
            <div className="modal-page" style={{maxWidth: 680}}>
              <header className="modal-page-header">
                <div className="modal-page-header-left">
                  <span className="modal-page-badge">DIRECT REFERRAL</span>
                  <h2>Register Candidate Referral</h2>
                </div>
                <div className="modal-page-header-right">
                  <button type="button" className="icon-btn" onClick={() => setRegisterModalOpen(false)} aria-label="Close">
                    <X size={20} />
                  </button>
                </div>
              </header>
              <form onSubmit={e => void handleRegisterCandidate(e)} style={{display: 'flex', flexDirection: 'column', flex: 1}}>
                <div className="modal-page-body">
                  <div className="modal-page-card">
                    <h3>Candidate Information</h3>
                    <p>Enter your referral&apos;s details to directly register their application with your attribution code ({referralData?.agentCode}).</p>
                    <div className="form-grid">
                      <div className="field full">
                        <label>Candidate full name *</label>
                        <input
                          required
                          placeholder="E.g. Natasha Chileshe"
                          value={candName}
                          onChange={e => setCandName(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Candidate phone number *</label>
                        <input
                          required
                          type="tel"
                          placeholder="+260 97X XXX XXX"
                          value={candPhone}
                          onChange={e => setCandPhone(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Email address (optional)</label>
                        <input
                          type="email"
                          placeholder="candidate@example.com"
                          value={candEmail}
                          onChange={e => setCandEmail(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>NRC / National ID (optional)</label>
                        <input
                          placeholder="123456/10/1"
                          value={candNrc}
                          onChange={e => setCandNrc(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Home District / Constituency</label>
                        <input
                          placeholder="E.g. Chisamba, Lusaka"
                          value={candDistrict}
                          onChange={e => setCandDistrict(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="modal-page-card">
                    <h3>Programme & Funding Pathway</h3>
                    <div className="form-grid">
                      <div className="field full">
                        <label>Selected training programme *</label>
                        <select value={candProg} onChange={e => setCandProg(e.target.value)}>
                          {defaultProgrammes.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field full">
                        <label>Funding method</label>
                        <select value={candFunding} onChange={e => setCandFunding(e.target.value as 'cdf' | 'self_funded')}>
                          <option value="cdf">Constituency Development Fund (CDF Sponsorship)</option>
                          <option value="self_funded">Self-funded / Private Tuition</option>
                        </select>
                      </div>
                      <div className="field full">
                        <label>Notes to admissions (optional)</label>
                        <textarea
                          rows={2}
                          placeholder="Add any relevant information about this candidate's application..."
                          value={candNote}
                          onChange={e => setCandNote(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <footer className="modal-page-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setRegisterModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={registerBusy || !candName.trim() || !candPhone.trim()}
                  >
                    <Plus size={16} /> {registerBusy ? 'Registering…' : 'Register referral'}
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={Boolean(withdrawalTarget)}
          title={`Withdraw ${withdrawalTarget?.type === 'app' ? 'Application' : 'Referral'}`}
          message={`Are you sure you want to withdraw ${withdrawalTarget?.type === 'app' ? 'application' : 'referral'} ${withdrawalTarget?.ref}? This action cannot be reversed.`}
          kind="danger"
          confirmLabel="Withdraw Record"
          cancelLabel="Cancel"
          busy={busy}
          onConfirm={() => void confirmWithdrawal()}
          onCancel={() => setWithdrawalTarget(null)}
        />
      </main>
    </SiteChrome>
  );
}


