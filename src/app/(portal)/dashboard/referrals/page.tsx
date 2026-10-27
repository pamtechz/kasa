'use client';
import {useEffect, useState, useMemo, useRef} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {
  Copy, Share2, Users, Wallet, Plus, ExternalLink, RefreshCw,
  Search, Edit, Trash2, ArrowLeft, Save, X, Phone, User, CheckCircle2, AlertCircle
} from 'lucide-react';
import {api, PageHeader, StatusBadge} from '@/components/Portal';
import {ConfirmModal} from '@/components/ConfirmModal';

type Referral = {
  id: string;
  reference: string;
  candidateName?: string;
  phone?: string;
  programme?: string;
  fundingMethod?: string;
  submittedAt: string;
  status: string;
  note?: string;
  commission?: {
    amount: number;
    currency: string;
    trigger: string;
    paidAt: string | null;
  } | null;
};

type FormInfo = {slug: string; title: string};

type ReferralResponse = {
  agent: {agentCode: string; district: string; active?: boolean};
  forms: FormInfo[];
  referrals: Referral[];
};

const defaultProgrammes = [
  'Heavy Equipment Operations & Plant Maintenance',
  'Commercial Agribusiness & Irrigation Systems',
  'Automotive Mechanics & Heavy Vehicle Repair',
  'Industrial Electrical & Solar Systems Installation',
  'Construction & Bricklaying Technology',
  'Metal Fabrication & Arc Welding',
  'Carpentry & Joinery',
  'Information & Communications Technology'
];

export default function MyReferrals({editorId}:{editorId?:string}={}) {
  const router=useRouter();
  const loadedEditor=useRef(false);
  const editorHref=(id:string)=>'/dashboard/referrals/editor/'+encodeURIComponent(id);
  const [data, setData] = useState<ReferralResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingRef, setDeletingRef] = useState<Referral | null>(null);
  const [selectedRefIds, setSelectedRefIds] = useState<Set<string>>(new Set());
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<'selected' | 'all' | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'paid'>('all');

  // Modal page states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReferral, setEditingReferral] = useState<Referral | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nrc, setNrc] = useState('');
  const [programme, setProgramme] = useState(defaultProgrammes[0]);
  const [fundingMethod, setFundingMethod] = useState<'cdf' | 'self_funded'>('cdf');
  const [district, setDistrict] = useState('');
  const [note, setNote] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api<ReferralResponse>('/api/agent/referrals');
      setData(res);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load referrals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modalOpen]);

  function openRegisterModal() {
    setEditingReferral(null);
    setCandidateName('');
    setPhone('');
    setEmail('');
    setNrc('');
    setProgramme(defaultProgrammes[0]);
    setFundingMethod('cdf');
    setDistrict(data?.agent.district || '');
    setNote('');
    setModalOpen(true);
  }

  function openEditModal(ref: Referral) {
    setEditingReferral(ref);
    setCandidateName(ref.candidateName || '');
    setPhone(ref.phone || '');
    setEmail('');
    setNrc('');
    setProgramme(ref.programme || defaultProgrammes[0]);
    setFundingMethod((ref.fundingMethod as 'cdf' | 'self_funded') || 'cdf');
    setDistrict(data?.agent.district || '');
    setNote(ref.note || '');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingReferral(null);
    if(editorId)router.push('/dashboard/referrals');
  }

  useEffect(()=>{
    if(!editorId||!data||loadedEditor.current)return;
    loadedEditor.current=true;
    if(editorId==='new')openRegisterModal();
    else{
      const item=data.referrals.find(x=>x.id===editorId);
      if(item)openEditModal(item);
      else setError('Candidate not found. Return to the referrals list.');
    }
  },[editorId,data]);

  async function handleSaveCandidate(e: React.FormEvent) {
    e.preventDefault();
    if (!candidateName.trim() || !phone.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (editingReferral) {
        await api('/api/agent/referrals', {
          method: 'PATCH',
          body: JSON.stringify({
            id: editingReferral.id,
            candidateName: candidateName.trim(),
            phone: phone.trim(),
            note: note.trim()
          })
        });
        setNotice(`Updated details for candidate ${candidateName}.`);
      } else {
        const res = await api<{ok: boolean; reference: string}>('/api/agent/referrals', {
          method: 'POST',
          body: JSON.stringify({
            candidateName: candidateName.trim(),
            phone: phone.trim(),
            email: email.trim(),
            nrc: nrc.trim(),
            programme,
            fundingMethod,
            district: district.trim() || data?.agent.district,
            note: note.trim()
          })
        });
        setNotice(`Candidate successfully registered with reference: ${res.reference}`);
      }
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register candidate.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteReferral() {
    if (!deletingRef) return;
    setBusy(true);
    try {
      await api(`/api/agent/referrals?id=${deletingRef.id}`, {method: 'DELETE'});
      setNotice(`Referral ${deletingRef.reference} has been withdrawn.`);
      setDeletingRef(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to withdraw referral.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmBulkDeleteReferrals() {
    if (!bulkDeleteTarget) return;
    setBusy(true);
    try {
      const idsToDelete = bulkDeleteTarget === 'selected' ? Array.from(selectedRefIds) : filtered.map(x => x.id);
      for (const id of idsToDelete) {
        await api(`/api/agent/referrals?id=${id}`, {method: 'DELETE'});
      }
      setNotice(`Successfully withdrawn ${idsToDelete.length} referral(s).`);
      setSelectedRefIds(new Set());
      setBulkDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk withdraw failed.');
    } finally {
      setBusy(false);
    }
  }

  const referralsList = useMemo(() => data?.referrals || [], [data?.referrals]);
  const total = useMemo(() => referralsList.reduce((n, r) => n + Number(r.commission?.amount || 0), 0), [referralsList]);
  const paid = useMemo(() => referralsList.reduce((n, r) => n + (r.commission?.paidAt ? Number(r.commission.amount) : 0), 0), [referralsList]);

  const filtered = useMemo(() => {
    return referralsList.filter(r => {
      if (statusFilter === 'pending' && ['cdf_approved', 'commission_paid'].includes(r.status)) return false;
      if (statusFilter === 'approved' && r.status !== 'cdf_approved') return false;
      if (statusFilter === 'paid' && r.status !== 'commission_paid') return false;
      if (q.trim()) {
        const query = q.toLowerCase();
        const matchRef = r.reference.toLowerCase().includes(query);
        const matchName = (r.candidateName || '').toLowerCase().includes(query);
        const matchPhone = (r.phone || '').toLowerCase().includes(query);
        const matchProg = (r.programme || '').toLowerCase().includes(query);
        return matchRef || matchName || matchPhone || matchProg;
      }
      return true;
    });
  }, [referralsList, statusFilter, q]);

  const allReferralsSelected = filtered.length > 0 && filtered.every(x => selectedRefIds.has(x.id));

  function toggleSelectAllReferrals() {
    if (allReferralsSelected) setSelectedRefIds(new Set());
    else setSelectedRefIds(new Set(filtered.map(x => x.id)));
  }

  function toggleSelectReferral(id: string) {
    const next = new Set(selectedRefIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRefIds(next);
  }

  async function copy(slug: string) {
    const url = new URL('/apply/' + slug, window.location.origin);
    url.searchParams.set('ref', data?.agent.agentCode || '');
    await navigator.clipboard.writeText(url.toString());
    setNotice('Referral link copied. Candidates can use this link to apply directly with your attribution.');
  }

  return (
    <>
      {!editorId&&<>
      <PageHeader
        title="My referrals"
        subtitle="Directly register candidates, share your assigned code and track your verified commissions."
        action={
          <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
            <button className="btn btn-outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={15} /> Refresh
            </button>
            <Link className="btn btn-primary" href={editorHref('new')}>
              <Plus size={16} /> Register candidate
            </Link>
          </div>
        }
      />

      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon green"><Users /></div>
          <span>Total referrals</span>
          <strong>{loading ? '—' : referralsList.length}</strong>
          <small>Candidates attributed to code</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon amber"><Wallet /></div>
          <span>Eligible commissions</span>
          <strong>{loading ? '—' : `K${total.toFixed(2)}`}</strong>
          <small>Potential payouts earned</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon green"><Wallet /></div>
          <span>Payments recorded</span>
          <strong>{loading ? '—' : `K${paid.toFixed(2)}`}</strong>
          <small>Verified institution disbursements</small>
        </div>
      </div>

      <div className="panel pad-panel">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12}}>
          <div>
            <h2 style={{margin: '0 0 4px'}}>District Agent Link & Code</h2>
            <p className="muted" style={{margin: 0}}>
              Your unique code: <strong style={{color: 'var(--ink)'}}>{data?.agent.agentCode || '—'}</strong> · Assigned district: <strong>{data?.agent.district || 'National'}</strong>
            </p>
          </div>
          {data?.forms.map(f => (
            <div key={f.slug} style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <button className="btn btn-outline" onClick={() => void copy(f.slug)}>
                <Copy size={15} /> Copy link ({f.title})
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title" style={{padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12}}>
          <div>
            <h2 style={{margin: '0 0 4px'}}>Attributed Candidates</h2>
            <p className="muted" style={{margin: 0}}>Review candidate enrollment status, update notes, or withdraw pending submissions.</p>
          </div>

          <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center'}}>
            <div style={{position: 'relative', minWidth: 200}}>
              <input
                type="text"
                placeholder="Search candidate…"
                value={q}
                onChange={e => setQ(e.target.value)}
                style={{paddingLeft: 30, fontSize: 13, height: 36}}
              />
              <Search size={14} style={{position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)'}} />
            </div>

            <div style={{display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap'}}>
              {selectedRefIds.size > 0 && (
                <button className="btn btn-outline" disabled={busy} onClick={() => setBulkDeleteTarget('selected')} style={{fontSize: 12, padding: '6px 12px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', display: 'inline-flex', alignItems: 'center', gap: 6}}>
                  <Trash2 size={14} /> Withdraw Selected ({selectedRefIds.size})
                </button>
              )}
              {filtered.length > 0 && (
                <button className="btn btn-outline" disabled={busy} onClick={() => setBulkDeleteTarget('all')} style={{fontSize: 12, padding: '6px 12px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', display: 'inline-flex', alignItems: 'center', gap: 6}}>
                  <Trash2 size={14} /> Withdraw All ({filtered.length})
                </button>
              )}
              <button
                className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStatusFilter('all')}
              >
                All ({referralsList.length})
              </button>
              <button
                className={`btn btn-sm ${statusFilter === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStatusFilter('pending')}
              >
                Pending
              </button>
              <button
                className={`btn btn-sm ${statusFilter === 'approved' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStatusFilter('approved')}
              >
                Approved
              </button>
              <button
                className={`btn btn-sm ${statusFilter === 'paid' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStatusFilter('paid')}
              >
                Paid
              </button>
            </div>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{width: 40}}><input type="checkbox" checked={allReferralsSelected} onChange={toggleSelectAllReferrals} aria-label="Select all referrals"/></th>
                <th>Reference</th>
                <th>Candidate Name</th>
                <th>Programme</th>
                <th>Phone</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Commission</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="empty-state">Loading candidate referrals…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    {referralsList.length === 0
                      ? 'No candidate referrals recorded yet. Click "Register candidate" above to register your first student.'
                      : 'No referrals match your search or status filter.'}
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id}>
                    <td><input type="checkbox" checked={selectedRefIds.has(r.id)} onChange={() => toggleSelectReferral(r.id)} aria-label={`Select ${r.reference}`}/></td>
                    <td><strong>{r.reference}</strong></td>
                    <td>
                      <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                        <User size={15} style={{color: 'var(--green)'}} />
                        <strong>{r.candidateName || 'Candidate'}</strong>
                      </div>
                    </td>
                    <td><small>{r.programme || 'Vocational Training'}</small></td>
                    <td>{r.phone || '—'}</td>
                    <td>{new Date(r.submittedAt).toLocaleDateString()}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      {r.commission ? (
                        <span style={{fontWeight: 600, color: r.commission.paidAt ? '#10b981' : 'var(--gold)'}}>
                          K{r.commission.amount.toFixed(2)} {r.commission.paidAt ? '· Paid' : '· Pending'}
                        </span>
                      ) : (
                        <span className="muted">Subject to approval</span>
                      )}
                    </td>
                    <td>
                      <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
                        {['submitted', 'under_review', 'needs_information'].includes(r.status) && (
                          <>
                            <button
                              className="icon-btn"
                              title="Edit candidate contact"
                              onClick={() => router.push(editorHref(r.id))}
                              aria-label="Edit candidate contact"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              className="icon-btn"
                              style={{color: '#ef4444'}}
                              title="Withdraw referral"
                              onClick={() => setDeletingRef(r)}
                              aria-label="Withdraw referral"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                        {!['submitted', 'under_review', 'needs_information'].includes(r.status) && (
                          <span className="muted" style={{fontSize: 12}}>Locked</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      </>}
      {editorId&&<PageHeader title="Candidate referral editor" subtitle="Dedicated page for creating or updating candidate referrals."/>}
      {editorId&&error&&<div className="alert-error" role="alert">{error}</div>}
      {/* Routed form page for candidate registration / edit */}
      {modalOpen && (
        <div className="editor-page-layout">
          <div className="modal-page editor-page-surface">
            <header className="modal-page-header">
              <div className="modal-page-title-group">
                <button
                  type="button"
                  className="modal-page-back-btn"
                  onClick={closeModal}
                  aria-label="Back to referrals"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="modal-page-heading">
                  <span className="modal-page-badge">
                    {editingReferral ? 'EDIT CANDIDATE' : 'NEW STUDENT ENROLLMENT'}
                  </span>
                  <h2>{editingReferral ? `Edit: ${editingReferral.reference}` : 'Register New Candidate'}</h2>
                  <p className="modal-page-sub">
                    Directly enroll a student in your district. Referral commissions are attributed immediately upon institutional verification.
                  </p>
                </div>
              </div>
              <div className="modal-page-header-actions">
                <button
                  type="button"
                  className="icon-btn modal-page-close-btn"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <form onSubmit={e => void handleSaveCandidate(e)} style={{display: 'contents'}}>
              <div className="modal-page-body">
                <div className="modal-page-card">
                  <h3 className="modal-page-card-title">Candidate Details</h3>
                  <div className="form-grid">
                    <div className="field">
                      <label>Full candidate name *</label>
                      <input
                        type="text"
                        value={candidateName}
                        onChange={e => setCandidateName(e.target.value)}
                        placeholder="E.g. Mwamba Chileshe"
                        required
                      />
                    </div>

                    <div className="field">
                      <label>Contact phone number *</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="E.g. 0977 123 456"
                        required
                      />
                    </div>

                    {!editingReferral && (
                      <>
                        <div className="field">
                          <label>NRC (National Registration Card)</label>
                          <input
                            type="text"
                            value={nrc}
                            onChange={e => setNrc(e.target.value)}
                            placeholder="E.g. 123456/11/1"
                          />
                        </div>

                        <div className="field">
                          <label>Email address (optional)</label>
                          <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="E.g. student@email.com"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="modal-page-card">
                  <h3 className="modal-page-card-title">Programme & Sponsorship</h3>
                  <div className="form-grid">
                    <div className="field">
                      <label>Training programme *</label>
                      <select
                        value={programme}
                        onChange={e => setProgramme(e.target.value)}
                        disabled={Boolean(editingReferral)}
                      >
                        {defaultProgrammes.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label>Funding sponsorship *</label>
                      <select
                        value={fundingMethod}
                        onChange={e => setFundingMethod(e.target.value as 'cdf' | 'self_funded')}
                        disabled={Boolean(editingReferral)}
                      >
                        <option value="cdf">Constituency Development Fund (CDF Sponsorship)</option>
                        <option value="self_funded">Self-funded / Personal payment</option>
                      </select>
                    </div>

                    <div className="field">
                      <label>District location</label>
                      <input
                        type="text"
                        value={district}
                        onChange={e => setDistrict(e.target.value)}
                        placeholder="E.g. Mpika District"
                        disabled={Boolean(editingReferral)}
                      />
                    </div>
                  </div>

                  <div className="field" style={{marginTop: 16}}>
                    <label>Agent private notes</label>
                    <textarea
                      rows={3}
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Add any relevant notes regarding candidate readiness, previous education, or CDF committee submission…"
                    />
                  </div>
                </div>
              </div>

              <footer className="modal-page-footer">
                <div className="modal-page-footer-left">
                  <span className="muted" style={{fontSize: 13}}>
                    Commission of <strong>K300.00</strong> will be attributed to code: <strong>{data?.agent.agentCode}</strong>
                  </span>
                </div>
                <div className="modal-page-footer-actions">
                  <button type="button" className="btn btn-outline" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={busy || !candidateName.trim() || !phone.trim()}>
                    <Save size={16} /> {busy ? 'Saving…' : editingReferral ? 'Update candidate' : 'Register candidate'}
                  </button>
                </div>
              </footer>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingRef)}
        title="Withdraw Candidate Referral"
        message={`Are you sure you want to withdraw referral ${deletingRef?.reference} (${deletingRef?.candidateName || 'Candidate'})? This will cancel the referral application.`}
        kind="danger"
        confirmLabel="Withdraw Referral"
        cancelLabel="Cancel"
        busy={busy}
        onConfirm={() => void confirmDeleteReferral()}
        onCancel={() => setDeletingRef(null)}
      />

      <ConfirmModal
        isOpen={Boolean(bulkDeleteTarget)}
        title="Withdraw Multiple Candidate Referrals"
        message={`Are you sure you want to withdraw ${bulkDeleteTarget === 'selected' ? `${selectedRefIds.size} selected` : `all ${filtered.length}`} candidate referral(s)?`}
        kind="danger"
        confirmLabel="Withdraw Referrals"
        cancelLabel="Cancel"
        busy={busy}
        onConfirm={() => void confirmBulkDeleteReferrals()}
        onCancel={() => setBulkDeleteTarget(null)}
      />
    </>
  );
}
