'use client';

import {useState, useEffect} from 'react';
import Link from 'next/link';
import {
  Wallet, DollarSign, CheckCircle2, Search, Filter, RefreshCw, FileText,
  Plus, Download, ShieldCheck, Building2, CreditCard
} from 'lucide-react';
import {api, PageHeader, StatusBadge} from '@/components/Portal';
import {can} from '@/lib/permissions';
import type {Role} from '@/lib/types';

type Summary = {
  totalRevenueExpected: number;
  totalPaymentsReceived: number;
  outstandingBalance: number;
  totalCdfApproved: number;
  missingFeeQuotes: number;
  financialTotalsPartial: boolean;
  paymentReconciliationRequired: number;
  truncated: boolean;
};

type LedgerItem = {
  id: string;
  reference: string;
  studentName: string;
  programme: string;
  fundingMethod: string;
  status: string;
  totalPackage: number | null;
  feeStatus: 'approved' | 'requires_reconciliation';
  paidAmount: number;
  outstandingBalance: number | null;
  paymentReference?: string;
  verifiedAt?: string;
  submittedAt: string;
};

export default function FinanceDashboardPage() {
  const [role,setRole]=useState<Role|null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [search, setSearch] = useState('');
  const [fundingFilter, setFundingFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadFinanceData = async () => {
    setLoading(true);
    try {
      const res = await api<{summary: Summary; ledger: LedgerItem[]}>('/api/admin/finance');
      setSummary(res.summary);
      setLedger(Array.isArray(res.ledger) ? res.ledger : []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load finance ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFinanceData();
    void api<{profile:{role:Role}}>('/api/me').then(v=>setRole(v.profile.role)).catch(()=>setRole(null));
  }, []);

  const filteredLedger = ledger.filter(item => {
    if (fundingFilter !== 'all' && item.fundingMethod !== fundingFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.reference.toLowerCase().includes(q) ||
      item.studentName.toLowerCase().includes(q) ||
      item.programme.toLowerCase().includes(q) ||
      String(item.paymentReference || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <PageHeader
        title="Financial Management & Tuition Ledger"
        subtitle="Manage self-funded tuition payments, record tuition receipts, and monitor revenue ledgers. Enrollment funding approval remains a separate review."
        action={<div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <Link className="btn btn-outline" href="/dashboard/finance/tariffs">Approved tariff registry</Link>
          <button className="btn btn-outline" onClick={() => void loadFinanceData()} disabled={loading} style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh Ledger
          </button>
        </div>}
      />

      {error && <div className="alert-error" style={{marginBottom: 16}}>{error}</div>}
      {message && <div className="notice" style={{marginBottom: 16}}><CheckCircle2 size={16} /> {message}</div>}
      {summary?.financialTotalsPartial && <div className="notice" role="status" style={{marginBottom: 16}}>{summary.missingFeeQuotes} application(s) need approved fee reconciliation; {summary.paymentReconciliationRequired||0} have invalid payment data.{summary.truncated?' Ledger scan limit reached.':''} Totals below exclude unquoted liabilities and cannot be represented as complete. Previously recorded receipts remain visible.</div>}

      {/* Finance Metrics Overview */}
      <div className="metric-grid" style={{marginBottom: 24}}>
        <div className="metric-card">
          <div className="metric-icon blue"><DollarSign /></div>
          <span>Total Accrued Revenue</span>
          <strong>{loading ? '—' : summary?.financialTotalsPartial ? 'Incomplete' : `ZMW ${(summary?.totalRevenueExpected || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`}</strong>
          <small>Approved quoted fees only</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon green"><Wallet /></div>
          <span>Recorded Payments</span>
          <strong>{loading ? '—' : `ZMW ${(summary?.totalPaymentsReceived || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`}</strong>
          <small>Bank & Mobile Money received</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon amber"><Building2 /></div>
          <span>CDF Council Approved</span>
          <strong>{loading ? '—' : summary?.financialTotalsPartial ? 'Incomplete' : `ZMW ${(summary?.totalCdfApproved || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`}</strong>
          <small>Government bursary funding</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon purple"><CreditCard /></div>
          <span>Outstanding Balance</span>
          <strong>{loading ? '—' : summary?.financialTotalsPartial ? 'Incomplete' : `ZMW ${(summary?.outstandingBalance || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`}</strong>
          <small>Reconciled balances only</small>
        </div>
      </div>

      {/* Student Financial Ledger Table */}
      <div className="panel">
        <div className="panel-title" style={{flexWrap: 'wrap', gap: 12}}>
          <div>
            <h2>Student Financial Ledger</h2>
            <p>Record student payments, verify bank receipts, and track CDF bursary funding.</p>
          </div>

          <div className="table-controls" style={{margin: 0, padding: 0, background: 'transparent', border: 'none'}}>
            <label className="search-box">
              <Search size={16} />
              <input placeholder="Search by student name, reference or receipt..." value={search} onChange={e => setSearch(e.target.value)} />
            </label>
            <label className="filter-select">
              <Filter size={16} />
              <select value={fundingFilter} onChange={e => setFundingFilter(e.target.value)}>
                <option value="all">All Funding Pathways</option>
                <option value="self_funded">Self-Funded / Private</option>
                <option value="cdf">CDF Sponsorship</option>
              </select>
            </label>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Student Name</th>
                <th>Course / Package</th>
                <th>Pathway</th>
                <th>Paid / Total</th>
                <th>Receipt / Bank Ref</th>
                <th>Finance Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="empty-state">Loading financial ledger…</td></tr>
              ) : filteredLedger.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No financial records found matching your query.</td></tr>
              ) : (
                filteredLedger.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.reference}</strong></td>
                    <td>{item.studentName}</td>
                    <td><small>{item.programme}</small></td>
                    <td>
                      <span className={`tag ${item.fundingMethod === 'cdf' ? 'tag-purple' : 'tag-green'}`}>
                        {item.fundingMethod === 'cdf' ? 'CDF Sponsorship' : 'Self-Funded'}
                      </span>
                    </td>
                    <td>
                      <strong style={{color: item.totalPackage !== null && item.paidAmount >= item.totalPackage ? 'var(--green)' : 'var(--ink)'}}>
                        ZMW {item.paidAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}
                      </strong>
                      <small className="table-sub">{item.totalPackage === null ? 'Fee reconciliation required' : `of ZMW ${item.totalPackage.toLocaleString('en-US', {minimumFractionDigits: 2})}`}</small>
                    </td>
                    <td>
                      {item.paymentReference ? <code>{item.paymentReference}</code> : <span className="muted">—</span>}
                    </td>
                    <td>
                      {item.feeStatus === 'requires_reconciliation' ? can(role,'finance.record') ? <Link
                        className="btn btn-sm btn-primary" href={'/dashboard/finance/'+encodeURIComponent(item.id)+'/reconcile'}>
                        Reconcile quote
                      </Link> : <span className="muted">Unquoted</span>
                    : item.fundingMethod === 'cdf' ? <span className="muted">CDF funding — separate approval</span> : item.outstandingBalance === 0 ? <span className="muted">Settled</span> : can(role,'finance.record') ? <Link className="btn btn-sm btn-primary" href={'/dashboard/finance/'+encodeURIComponent(item.id)+'/receipt'}
                        style={{padding:'4px 10px',fontSize:12,display:'inline-flex',alignItems:'center',gap:4}}>
                        <Plus size={13}/> Record payment
                      </Link> : <span className="muted">Read only</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </>
  );
}
