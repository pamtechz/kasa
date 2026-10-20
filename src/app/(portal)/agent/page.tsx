'use client';

import {useState, useEffect} from 'react';
import Link from 'next/link';
import {AgentPortal} from '@/components/AgentPortal';
import {
  Users, MapPin, Award, Wallet, PlusCircle, Share2, Copy, Check, RefreshCw, FileText
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

export default function AgentDashboardPage() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [meRes, refRes] = await Promise.all([
        fetch('/api/me', {headers, cache: 'no-store'}),
        fetch('/api/agent/referrals', {headers, cache: 'no-store'}).catch(() => null)
      ]);

      const meJson = await meRes.json();
      if (meRes.ok && meJson.profile) {
        setProfile(meJson.profile);
      }

      if (refRes && refRes.ok) {
        const refJson = await refRes.json().catch(() => null);
        if (refJson) setReferralData(refJson);
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

  return (
    <AgentPortal>
      <div className="page-heading">
        <div>
          <h1>District Recruitment Overview</h1>
          <p>Welcome back, <strong>{profile?.displayName || profile?.email || 'District Agent'}</strong>. Manage your assigned district, register candidates, and track verified commissions.</p>
        </div>
        <div style={{display: 'flex', gap: 10}}>
          <Link href="/dashboard/applications/new" className="btn btn-primary" style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <PlusCircle size={16} /> Register New Candidate
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
          <span>Verified Admissions</span>
          <strong>{loading ? '—' : referralData?.successfulCount || 0}</strong>
          <small>CDF approved or tuition paid</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon purple"><Wallet /></div>
          <span>Total Commission</span>
          <strong>{loading ? '—' : `ZMW ${(referralData?.totalEarned || 0).toFixed(2)}`}</strong>
          <small>Earned on verified students</small>
        </div>
      </div>

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
    </AgentPortal>
  );
}
