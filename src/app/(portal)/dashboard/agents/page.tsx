'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {CheckCircle2, Copy, Plus, Share2, Users, Edit, Trash2, Award, MapPin, TrendingUp} from 'lucide-react';
import {api, cachedApi, PageHeader} from '@/components/Portal';
import {ConfirmModal} from '@/components/ConfirmModal';
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
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<'selected' | 'all' | null>(null);
  const [loading, setLoading] = useState(true);
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

  async function confirmDeleteAgent() {
    if (!deletingAgent) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/api/admin/agents/${deletingAgent.uid}`, { method: 'DELETE' });
      setNotice(`Agent ${deletingAgent.displayName} has been removed.`);
      setDeletingAgent(null);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove agent.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmBulkDeleteAgents() {
    if (!bulkDeleteTarget) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const uidsToDelete = bulkDeleteTarget === 'selected' ? Array.from(selectedUids) : agents.map(a => a.uid);
      for (const uid of uidsToDelete) {
        await api(`/api/admin/agents/${uid}`, { method: 'DELETE' });
      }
      setNotice(`Successfully removed ${uidsToDelete.length} agent(s).`);
      setSelectedUids(new Set());
      setBulkDeleteTarget(null);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk removal failed.');
    } finally {
      setBusy(false);
    }
  }

  const allAgentsSelected = agents.length > 0 && agents.every(a => selectedUids.has(a.uid));

  function toggleSelectAllAgents() {
    if (allAgentsSelected) {
      setSelectedUids(new Set());
    } else {
      setSelectedUids(new Set(agents.map(a => a.uid)));
    }
  }

  function toggleSelectAgent(uid: string) {
    const next = new Set(selectedUids);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    setSelectedUids(next);
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

      <div className="metric-grid" style={{marginBottom: 20}}>
        <div className="metric-card">
          <div className="metric-icon blue"><Users /></div>
          <span>Active Agents</span>
          <strong>{agents.filter(a => a.active).length}</strong>
          <small>Across 116 districts</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon green"><MapPin /></div>
          <span>Covered Districts</span>
          <strong>{new Set(agents.map(a => a.district).filter(Boolean)).size}</strong>
          <small>Active district hubs</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon purple"><Award /></div>
          <span>Top District</span>
          <strong>{agents[0]?.district || 'Lusaka'}</strong>
          <small>Highest recruitment</small>
        </div>
      </div>

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
        <div className="panel-title" style={{flexWrap:'wrap',gap:12}}>
          <div>
            <h2>Registered agents</h2>
            <p>Codes are for attribution and do not authorize CDF approvals.</p>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',marginLeft:'auto'}}>
            <span className="count-chip">{agents.length} agents</span>
            {selectedUids.size > 0 && (
              <button className="btn btn-outline" disabled={busy} onClick={() => setBulkDeleteTarget('selected')} style={{fontSize:12,padding:'6px 12px',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',display:'inline-flex',alignItems:'center',gap:6}}>
                <Trash2 size={14} /> Delete Selected ({selectedUids.size})
              </button>
            )}
            {agents.length > 0 && (
              <button className="btn btn-outline" disabled={busy} onClick={() => setBulkDeleteTarget('all')} style={{fontSize:12,padding:'6px 12px',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',display:'inline-flex',alignItems:'center',gap:6}}>
                <Trash2 size={14} /> Delete All Agents ({agents.length})
              </button>
            )}
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{width: 40}}><input type="checkbox" checked={allAgentsSelected} onChange={toggleSelectAllAgents} aria-label="Select all agents"/></th>
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
                    <td colSpan={6} style={{padding: '12px 24px'}}>
                      <div className="skeleton-row" />
                    </td>
                  </tr>
                ))
              ) : agents.length > 0 ? (
                agents.map(a => (
                  <tr key={a.uid}>
                    <td><input type="checkbox" checked={selectedUids.has(a.uid)} onChange={() => toggleSelectAgent(a.uid)} aria-label={`Select ${a.displayName}`}/></td>
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
                      <Link className="text-link" href={'/dashboard/agents/'+encodeURIComponent(a.uid)+'/edit'}>
                        <Edit size={14} /> Edit agent
                      </Link>
                      <button className="text-link" style={{color:'#ef4444'}} onClick={() => setDeletingAgent(a)} title="Remove agent">
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

      <ConfirmModal
        isOpen={Boolean(deletingAgent)}
        title="Remove District Agent"
        message={`Are you sure you want to remove agent "${deletingAgent?.displayName}" (${deletingAgent?.agentCode})? This action cannot be undone.`}
        kind="danger"
        confirmLabel="Remove Agent"
        cancelLabel="Cancel"
        busy={busy}
        onConfirm={() => void confirmDeleteAgent()}
        onCancel={() => setDeletingAgent(null)}
      />

      <ConfirmModal
        isOpen={Boolean(bulkDeleteTarget)}
        title="Remove Multiple District Agents"
        message={`Are you sure you want to remove ${bulkDeleteTarget === 'selected' ? `${selectedUids.size} selected` : `all ${agents.length}`} agent(s)? This action cannot be undone.`}
        kind="danger"
        confirmLabel="Remove Agents"
        cancelLabel="Cancel"
        busy={busy}
        onConfirm={() => void confirmBulkDeleteAgents()}
        onCancel={() => setBulkDeleteTarget(null)}
      />
    </>
  );
}
