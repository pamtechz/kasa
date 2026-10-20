'use client';

import {useState, useEffect} from 'react';
import {StudentPortal} from '@/components/StudentPortal';
import {
  Share2, Users, CheckCircle2, Wallet, Copy, Check, RefreshCw
} from 'lucide-react';
import {authHeaders} from '@/lib/firebase-client';

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

export default function StudentReferralsPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState('');

  const loadReferrals = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/student/referrals', {headers, cache: 'no-store'});
      if (!res.ok) throw new Error('Failed to load referral data.');
      const json = await res.json();
      setData(json);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load referrals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReferrals();
  }, []);

  async function copyToClipboard(text: string, type: 'link' | 'code') {
    await navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  return (
    <StudentPortal>
      <div className="page-heading">
        <div>
          <h1>Student Refer & Earn Program</h1>
          <p>Invite fellow students and prospective applicants to KASA using your personal referral link and earn ZMW rewards on verified enrollments.</p>
        </div>
        <button className="btn btn-outline" onClick={() => void loadReferrals()} disabled={loading} style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="alert-error" style={{marginBottom: 16}}>{error}</div>}

      {/* Metrics Row */}
      <div className="metric-grid" style={{marginBottom: 24}}>
        <div className="metric-card">
          <div className="metric-icon green"><Users /></div>
          <span>Total Candidates Invited</span>
          <strong>{loading ? '—' : data?.referralsCount || 0}</strong>
          <small>Registered using your code</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon amber"><CheckCircle2 /></div>
          <span>Successful Admissions</span>
          <strong>{loading ? '—' : data?.successfulCount || 0}</strong>
          <small>CDF approved or tuition verified</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon green"><Wallet /></div>
          <span>Total Commission Earned</span>
          <strong>{loading ? '—' : `ZMW ${(data?.totalEarned || 0).toFixed(2)}`}</strong>
          <small>Earn ZMW 300.00 per verified student</small>
        </div>
      </div>

      {/* Referral Link Sharing Box */}
      <div className="panel pad-panel" style={{marginBottom: 24, borderLeft: '4px solid var(--green, #103f2c)'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8}}>
          <Share2 size={20} style={{color: 'var(--green)'}} />
          <h2 style={{fontSize: 18, margin: 0}}>Your Personal Referral Link & Code</h2>
        </div>
        <p className="muted" style={{fontSize: 13, marginBottom: 16}}>
          Share this link or code with friends, relatives, and schoolmates. Anyone applying through your link automatically attributes their application to you.
        </p>

        <div className="form-grid">
          <div className="field full">
            <label>Personal Referral Link</label>
            <div style={{display: 'flex', gap: 8}}>
              <input
                type="text"
                readOnly
                value={data?.referralLink || 'https://kasaschool.vercel.app/apply/student-enrollment?ref=...'}
                style={{fontSize: 13, flex: 1, background: '#f8faf9', fontFamily: 'monospace'}}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => data?.referralLink && void copyToClipboard(data.referralLink, 'link')}
                style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
              >
                {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          <div className="field">
            <label>Your Referral Code</label>
            <div style={{display: 'flex', gap: 8}}>
              <span className="copy-code" style={{fontSize: 16, padding: '8px 14px', flex: 1, textAlign: 'center'}}>
                {data?.agentCode || 'KASA-STU-...'}
              </span>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => data?.agentCode && void copyToClipboard(data.agentCode, 'code')}
                style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
              >
                {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Candidates Table */}
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>Referred Candidates Ledger</h2>
            <p>Track the progress of students who applied using your referral code.</p>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Candidate Name</th>
                <th>Course</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Reward Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="empty-state">Loading referrals…</td></tr>
              ) : !data?.referrals || data.referrals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No referrals recorded yet. Copy your referral link above and share it with friends to get started!
                  </td>
                </tr>
              ) : (
                data.referrals.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.reference}</strong></td>
                    <td>{r.candidateName || 'Candidate'}</td>
                    <td><small>{r.programme}</small></td>
                    <td>{new Date(r.submittedAt).toLocaleDateString('en-GB')}</td>
                    <td><span className={'status-badge status-' + r.status}>{r.status.replaceAll('_', ' ')}</span></td>
                    <td>
                      <span style={{fontWeight: 700, color: r.commissionEarned > 0 ? 'var(--green)' : 'var(--gold)'}}>
                        ZMW {r.commissionEarned.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </StudentPortal>
  );
}
