'use client';

import {useState, useEffect} from 'react';
import Link from 'next/link';
import {AgentPortal} from '@/components/AgentPortal';
import {
  Users, MapPin, Award, Medal, Gem, Wallet, PlusCircle, Share2, Copy, Check, RefreshCw, Trophy, Sparkles
} from 'lucide-react';
import {authHeaders} from '@/lib/firebase-client';

type AgentProfile = {
  uid: string;
  email: string;
  displayName: string;
  agentCode: string;
  district: string;
  province?: string;
};

type ReferralData = {
  agentCode: string;
  referralLink: string;
  referralsCount: number;
  successfulCount: number;
  totalEarned: number;
};

type LeaderboardEntry = {
  uid: string;
  displayName: string;
  district: string;
  confirmedEnrollments: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
  eligibleForBonus: boolean;
  bonusAmount: number;
  totalPayoutWithBonus: number;
};

export default function AgentPortalDashboard() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [meRes, refRes, leadRes] = await Promise.all([
        fetch('/api/me', {headers, cache: 'no-store'}),
        fetch('/api/agent/referrals', {headers, cache: 'no-store'}).catch(() => null),
        fetch('/api/agent/leaderboard', {headers, cache: 'no-store'}).catch(() => null)
      ]);

      const meJson = await meRes.json();
      if (meRes.ok && meJson.profile) {
        setProfile(meJson.profile);
      }

      if (refRes && refRes.ok) {
        const refJson = await refRes.json().catch(() => null);
        if (refJson) setReferralData(refJson);
      }

      if (leadRes && leadRes.ok) {
        const leadJson = await leadRes.json().catch(() => null);
        if (leadJson?.leaderboard) setLeaderboard(leadJson.leaderboard);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
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

  const myEntry = leaderboard.find(l => l.uid === profile?.uid);
  const TierIcon = myEntry?.tier === 'Diamond' ? Gem : Medal;
  const tierClass = (myEntry?.tier || 'Bronze').toLowerCase();

  return (
    <AgentPortal>
      <div className="page-heading">
        <div>
          <h1>District Recruitment Portal</h1>
          <p>Welcome back, <strong>{profile?.displayName || profile?.email || 'District Agent'}</strong>. Manage recruitment across your assigned district territory, register candidates, and track verified commissions.</p>
        </div>
        <div style={{display: 'flex', gap: 10}}>
          <Link href="/dashboard/applications/new" className="btn btn-primary" style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <PlusCircle size={16} /> Register Candidate
          </Link>
          <button className="btn btn-outline" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Agent Metrics */}
      <div className="metric-grid" style={{marginBottom: 24}}>
        <div className="metric-card">
          <div className="metric-icon blue"><MapPin /></div>
          <span>Assigned Territory</span>
          <strong>{loading ? '—' : profile?.district || 'District Hub'}</strong>
          <small>{profile?.province || 'Zambia'}</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon green"><Users /></div>
          <span>Referred Candidates</span>
          <strong>{loading ? '—' : referralData?.referralsCount || 0}</strong>
          <small>Recruited under your code</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon amber"><Award /></div>
          <span>Achievement Tier</span>
          <strong>{loading ? '—' : <span className={'agent-tier-label agent-tier-'+tierClass}><TierIcon size={19} aria-hidden="true"/> {myEntry?.tier || 'Bronze'}</span>}</strong>
          <small>{myEntry?.confirmedEnrollments || 0} confirmed enrollments</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon purple"><Wallet /></div>
          <span>Total Commission</span>
          <strong>{loading ? '—' : `ZMW ${(myEntry?.totalPayoutWithBonus || referralData?.totalEarned || 0).toFixed(2)}`}</strong>
          <small>Including performance bonus</small>
        </div>
      </div>

      {/* Bonus Commission Eligibility Banner */}
      {myEntry?.eligibleForBonus && (
        <div style={{background: 'linear-gradient(135deg, #103f2c 0%, #175e42 100%)', color: '#ffffff', padding: '18px 24px', borderRadius: 12, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, boxShadow: '0 8px 24px rgba(16,63,44,0.15)'}}>
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold, #e0b561)', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase'}}>
              <Sparkles size={18} /> DIAMOND TIER BONUS UNLOCKED!
            </div>
            <h3 style={{margin: '4px 0 2px', fontSize: 18, color: '#ffffff'}}>Congratulations! You achieved 20+ confirmed enrollments this month!</h3>
            <p style={{margin: 0, fontSize: 13, color: '#d0e5d9'}}>You have unlocked a flat <strong>ZMW 1,000.00 Performance Bonus</strong> added to your monthly payout ledger.</p>
          </div>
          <span className="tag tag-gold" style={{fontSize: 16, padding: '8px 16px', fontWeight: 800}}>+ ZMW 1,000.00 BONUS</span>
        </div>
      )}

      {/* Agent Shareable Referral Code Box */}
      <div className="panel pad-panel" style={{marginBottom: 24, borderLeft: '4px solid var(--green)'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8}}>
          <Share2 size={20} style={{color: 'var(--green)'}} />
          <h2 style={{fontSize: 18, margin: 0}}>Official Agent Referral Link & Code</h2>
        </div>
        <p className="muted" style={{fontSize: 13, marginBottom: 16}}>
          Share this link with prospective students and guardians in your district. Applications submitted through this link auto-attribute to your agent account.
        </p>

        <div className="form-grid">
          <div className="field full">
            <label>District Referral Link</label>
            <div style={{display: 'flex', gap: 8}}>
              <input
                type="text"
                readOnly
                value={referralData?.referralLink || `https://kasaschool.vercel.app/apply/student-enrollment?ref=${profile?.agentCode || '...'}`}
                style={{fontSize: 13, flex: 1, background: '#f8faf9', fontFamily: 'monospace'}}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => referralData?.referralLink && void copyToClipboard(referralData.referralLink, 'link')}
                style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
              >
                {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          <div className="field">
            <label>Agent Identification Code</label>
            <div style={{display: 'flex', gap: 8}}>
              <span className="copy-code" style={{fontSize: 16, padding: '8px 14px', flex: 1, textAlign: 'center'}}>
                {profile?.agentCode || 'KASA-AGT-...'}
              </span>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => profile?.agentCode && void copyToClipboard(profile.agentCode, 'code')}
                style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
              >
                {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* District Recruitment Leaderboard */}
      <div className="panel">
        <div className="panel-title">
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <Trophy size={20} style={{color: 'var(--gold, #e0b561)'}} />
            <div>
              <h2>District Recruitment Leaderboard</h2>
              <p>Top recruitment performance across Zambia&apos;s 116 districts.</p>
            </div>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>District Agent</th>
                <th>District Territory</th>
                <th>Confirmed Enrollments</th>
                <th>Achievement Tier</th>
                <th>Earnings + Bonus</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="empty-state">Loading district leaderboard…</td></tr>
              ) : leaderboard.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No agent recruitment activity recorded for this month.</td></tr>
              ) : (
                leaderboard.map((entry, index) => (
                  <tr key={entry.uid} style={{background: entry.uid === profile?.uid ? 'rgba(16,63,44,0.06)' : undefined}}>
                    <td>
                      <strong>#{index + 1}</strong>
                    </td>
                    <td>
                      <strong>{entry.displayName}</strong>
                      {entry.uid === profile?.uid && <span className="tag tag-green" style={{marginLeft: 6, fontSize: 10}}>YOU</span>}
                    </td>
                    <td>{entry.district}</td>
                    <td><strong>{entry.confirmedEnrollments}</strong> students</td>
                    <td>
                      <span className={"tag tag-gold agent-tier-label agent-tier-"+entry.tier.toLowerCase()} style={{fontSize: 12}}>
                        {entry.tier === 'Diamond' ? <Gem size={15} aria-hidden="true"/> : <Medal size={15} aria-hidden="true"/>} {entry.tier}
                      </span>
                    </td>
                    <td>
                      <strong style={{color: 'var(--green)'}}>
                        ZMW {entry.totalPayoutWithBonus.toLocaleString('en-US', {minimumFractionDigits: 2})}
                      </strong>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AgentPortal>
  );
}
