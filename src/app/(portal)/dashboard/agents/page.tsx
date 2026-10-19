'use client';
import {useEffect, useState} from 'react';
import {CheckCircle2, Copy, Plus, Share2, Users, X, Edit, Save, ArrowLeft, Trash2} from 'lucide-react';
import {api, cachedApi, PageHeader} from '@/components/Portal';
import type {ApplicantRecord} from '@/lib/types';

type Agent = {
  uid: string;
  email: string;
  displayName: string;
  agentCode: string;
  district: string;
  province?: string;
  constituency?: string;
  ward?: string;
  active: boolean;
};

type FormInfo = {slug: string; title: string; kind: string; published: boolean};

export default function Agents() {
  const [forms, setForms] = useState<FormInfo[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recruitment, setRecruitment] = useState<ApplicantRecord[]>([]);
  const [applicationId, setApplicationId] = useState('');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editDistrict, setEditDistrict] = useState('');
  const [editActive, setEditActive] = useState(true);

  const load = async (force = false) => {
    try {
      if (force) {
        const [a, s, f] = await Promise.all([
          api<{agents: Agent[]}>('/api/admin/agents'),
          api<{submissions: ApplicantRecord[]}>('/api/admin/submissions'),
          api<{forms: FormInfo[]}>('/api/admin/forms')
        ]);
        setForms(f.forms.filter(x => x.kind === 'student' && x.published));
        setAgents(a.agents);
        setRecruitment(s.submissions.filter(x => x.formKind === 'agent' && x.status === 'accepted' && !('assignedAgentUid' in x)));
      } else {
        const [a, s, f] = await Promise.all([
          cachedApi<{agents: Agent[]}>('/api/admin/agents', fresh => setAgents(fresh.agents)),
          cachedApi<{submissions: ApplicantRecord[]}>('/api/admin/submissions', fresh =>
            setRecruitment(fresh.submissions.filter(x => x.formKind === 'agent' && x.status === 'accepted' && !('assignedAgentUid' in x)))
          ),
          cachedApi<{forms: FormInfo[]}>('/api/admin/forms', fresh =>
            setForms(fresh.forms.filter(x => x.kind === 'student' && x.published))
          )
        ]);
        setForms(f.forms.filter(x => x.kind === 'student' && x.published));
        setAgents(a.agents);
        setRecruitment(s.submissions.filter(x => x.formKind === 'agent' && x.status === 'accepted' && !('assignedAgentUid' in x)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function editAgent(a: Agent, change: Record<string, unknown>) {
    setError('');
    try {
      await api(`/api/admin/agents/${a.uid}`, {method: 'PATCH', body: JSON.stringify(change)});
      await load(true);
      setNotice('Agent details updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    }
  }

  function openEditModal(a: Agent) {
    setEditingAgent(a);
    setEditDistrict(a.district || '');
    setEditActive(a.active);
  }

  async function saveAgentModal() {
    if (!editingAgent) return;
    setBusy(true);
    try {
      await editAgent(editingAgent, {
        district: editDistrict,
        active: editActive
      });
      setEditingAgent(null);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAgent(a: Agent) {
    if (!window.confirm(`Are you sure you want to remove agent "${a.displayName}" (${a.agentCode})? This action cannot be undone.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/api/admin/agents/${a.uid}`, { method: 'DELETE' });
      setNotice(`Agent ${a.displayName} has been removed.`);
      if (editingAgent?.uid === a.uid) setEditingAgent(null);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove agent.');
    } finally {
      setBusy(false);
    }
  }

  async function shareAgent(a: Agent) {
    const form = forms[0];
    if (!form) {
      setError('Publish at least one student enrollment form first.');
      return;
    }
    const link = new URL('/apply/' + form.slug, window.location.origin);
    link.searchParams.set('ref', a.agentCode);
    await navigator.clipboard.writeText(link.toString());
    setNotice('Referral link copied for ' + a.displayName + '.');
  }

  async function assign() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const out = await api<{agentCode: string}>('/api/admin/agents', {
        method: 'POST',
        body: JSON.stringify({email, district, applicationId: applicationId || undefined})
      });
      setNotice(`Agent activated. Unique code: ${out.agentCode}`);
      setEmail('');
      setDistrict('');
      setApplicationId('');
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to assign agent.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="District agents"
        subtitle="Assign approved applicants to districts and issue verified referral codes."
      />

      <div className="panel pad-panel">
        <h2>Appoint an agent</h2>
        <p className="muted">
          Select an accepted recruitment application. The successful applicant must create and verify a sign-in account with the same email address. Only then can KASA activate the agent role.
        </p>
        <div className="inline-form">
          <select
            className="form-select"
            value={applicationId}
            onChange={e => setApplicationId(e.target.value)}
          >
            <option value="">Direct appointment (no prior application)</option>
            {recruitment.map(x => (
              <option key={x.id} value={x.id}>
                {x.reference} · {String(Object.values(x.answers).find(v => typeof v === 'string' && v.includes('@')) || 'Applicant')}
              </option>
            ))}
          </select>
          <input
            placeholder="Verified registered email address"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            placeholder="Assigned district"
            value={district}
            onChange={e => setDistrict(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={busy || !email.trim() || !district.trim()}
            onClick={() => void assign()}
          >
            <Plus size={17} /> Activate agent
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
        {notice && <p className="success-text">{notice}</p>}
      </div>

      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>Registered agents</h2>
            <p>Codes are for attribution and do not authorize CDF approvals.</p>
          </div>
          <span className="count-chip">{agents.length} agents</span>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>District</th>
                <th>Referral code</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length: 3}).map((_, i) => (
                  <tr key={'skel-agent-' + i}>
                    <td colSpan={5} style={{padding: '12px 24px'}}>
                      <div className="skeleton-row" />
                    </td>
                  </tr>
                ))
              ) : agents.length > 0 ? (
                agents.map(a => (
                  <tr key={a.uid}>
                    <td>
                      <strong>{a.displayName}</strong>
                      <small className="table-sub">{a.email}</small>
                    </td>
                    <td>{a.district}</td>
                    <td>
                      <button
                        className="copy-code"
                        title="Copy code"
                        onClick={() => void navigator.clipboard.writeText(a.agentCode)}
                      >
                        {a.agentCode}
                        <Copy size={14} />
                      </button>
                    </td>
                    <td>
                      <span className={'tag ' + (a.active ? 'tag-green' : 'tag-gray')}>
                        {a.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => void editAgent(a, {active: !a.active})}
                      >
                        {a.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        className="text-link"
                        onClick={() => void shareAgent(a)}
                        disabled={!forms.length}
                      >
                        <Share2 size={15} /> Share link
                      </button>
                      <button className="text-link" onClick={() => openEditModal(a)}>
                        <Edit size={14} /> Edit district
                      </button>
                      <button className="text-link" style={{color:'#ef4444'}} onClick={() => void deleteAgent(a)} title="Remove agent">
                        <Trash2 size={14} /> Remove
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="empty-state">
                    No agents assigned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PAGE FOR EDITING AGENT */}
      {editingAgent && (
        <div
          className="modal-page-overlay"
          role="dialog"
          aria-modal="true"
          onClick={e => {
            if (e.target === e.currentTarget) setEditingAgent(null);
          }}
        >
          <div className="modal-page" style={{maxWidth: 650, height: 'auto', maxHeight: '90vh'}}>
            <div className="modal-page-header">
              <div className="modal-page-header-left">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setEditingAgent(null)}
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <span className="overline" style={{color: '#2a7550', margin: 0}}>
                    EDIT AGENT
                  </span>
                  <h2>{editingAgent.displayName}</h2>
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setEditingAgent(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-page-body">
              <div className="modal-page-card">
                <h3>Agent Assignment Details</h3>
                <p>Modify assigned territory and active status.</p>

                <div className="field">
                  <label>Agent Name</label>
                  <input disabled value={editingAgent.displayName} />
                </div>

                <div className="field">
                  <label>Email Address</label>
                  <input disabled value={editingAgent.email} />
                </div>

                <div className="field">
                  <label>Referral Code</label>
                  <input disabled value={editingAgent.agentCode} />
                </div>

                <div className="field">
                  <label>Assigned District</label>
                  <input
                    placeholder="e.g. Chisamba, Chibombo, Lusaka"
                    value={editDistrict}
                    onChange={e => setEditDistrict(e.target.value)}
                  />
                </div>

                <label className="required-toggle" style={{marginTop: 16}}>
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={e => setEditActive(e.target.checked)}
                  />
                  Agent account is active and able to refer students
                </label>
              </div>
            </div>

            <div className="modal-page-footer">
              <button
                type="button"
                className="btn btn-outline"
                style={{color:'#ef4444',borderColor:'rgba(239,68,68,0.3)',marginRight:'auto'}}
                disabled={busy}
                onClick={() => void deleteAgent(editingAgent)}
              >
                <Trash2 size={16} /> Remove agent
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setEditingAgent(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !editDistrict.trim()}
                onClick={() => void saveAgentModal()}
              >
                <Save size={16} /> Save agent details
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
