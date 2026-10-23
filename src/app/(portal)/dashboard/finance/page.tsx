'use client';

import {useState, useEffect} from 'react';
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

  // Payment Recording Modal State
  const [recordingItem, setRecordingItem] = useState<LedgerItem | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Deposit');
  const [payReceipt, setPayReceipt] = useState('');
  const [payNote, setPayNote] = useState('');
  const [recordingBusy, setRecordingBusy] = useState(false);

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

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!recordingItem || !can(role,'finance.record') || recordingItem.fundingMethod === 'cdf' ||
        (recordingItem.totalPackage !== null && recordingItem.outstandingBalance === 0)) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    setRecordingBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api<{ok: boolean; message: string}>('/api/admin/finance', {
        method: 'POST',
        body: JSON.stringify({
          submissionId: recordingItem.id,
          amountPaid: amount,
          paymentMethod: payMethod,
          receiptReference: payReceipt,
          note: payNote
        })
      });

      setMessage(res.message);
      setRecordingItem(null);
      setPayAmount('');
      setPayReceipt('');
      setPayNote('');
      await loadFinanceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setRecordingBusy(false);
    }
  }

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
        action={
          <button className="btn btn-outline" onClick={() => void loadFinanceData()} disabled={loading} style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh Ledger
          </button>
        }
      />

      {error && <div className="alert-error" style={{marginBottom: 16}}>{error}</div>}
      {message && <div className="notice" style={{marginBottom: 16}}><CheckCircle2 size={16} /> {message}</div>}
      {summary?.financialTotalsPartial && <div className="notice" role="status" style={{marginBottom: 16}}>{summary.missingFeeQuotes} application(s) need approved fee reconciliation. Totals below exclude unquoted liabilities. Recorded receipts remain visible.</div>}

      {/* Finance Metrics Overview */}
      <div className="metric-grid" style={{marginBottom: 24}}>
        <div className="metric-card">
          <div className="metric-icon blue"><DollarSign /></div>
          <span>Total Accrued Revenue</span>
          <strong>{loading ? '—' : `ZMW ${(summary?.totalRevenueExpected || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`}</strong>
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
          <strong>{loading ? '—' : `ZMW ${(summary?.totalCdfApproved || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`}</strong>
          <small>Government bursary funding</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon purple"><CreditCard /></div>
          <span>Outstanding Balance</span>
          <strong>{loading ? '—' : `ZMW ${(summary?.outstandingBalance || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`}</strong>
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
                      {item.fundingMethod === 'cdf' ? <span className="muted">CDF funding — separate approval</span> : item.totalPackage !== null && item.outstandingBalance === 0 ? <span className="muted">Settled</span> : can(role,'finance.record') ? <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setRecordingItem(item);
                          setPayAmount('');
                          setPayReceipt('');
                          setPayNote('');
                        }}
                        style={{padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4}}
                      >
                        <Plus size={13} /> Record Payment
                      </button> : <span className="muted">Read only</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL PAGE */}
      {recordingItem && can(role,'finance.record') && (
        <div className="modal-page-overlay" role="dialog" aria-modal="true">
          <div className="modal-page" style={{maxWidth: 620}}>
            <header className="modal-page-header">
              <div className="modal-page-header-left">
                <span className="modal-page-badge">FINANCIAL RECEIPT RECORD</span>
                <h2>Record Tuition Payment: {recordingItem.reference}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setRecordingItem(null)} aria-label="Close">
                ✕
              </button>
            </header>

            <form onSubmit={e => void handleRecordPayment(e)} style={{display: 'flex', flexDirection: 'column', flex: 1}}>
              <div className="modal-page-body">
                <div className="modal-page-card">
                  <h3><DollarSign size={18} /> Student & Package Summary</h3>
                  <div style={{background: '#f8faf9', padding: 14, borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16, fontSize: 13, lineHeight: 1.6}}>
                    Student Name: <strong>{recordingItem.studentName}</strong><br />
                    Course: <strong>{recordingItem.programme}</strong><br />
                    Total Package Fee: <strong>{recordingItem.totalPackage === null ? 'Requires reconciliation' : `ZMW ${recordingItem.totalPackage.toLocaleString('en-US', {minimumFractionDigits: 2})}`}</strong><br />
                    Total Paid to Date: <strong>ZMW {recordingItem.paidAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong><br />
                    Remaining Balance: <strong style={{color: 'var(--green)'}}>{recordingItem.outstandingBalance === null ? 'Not confirmed' : `ZMW ${recordingItem.outstandingBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}`}</strong>
                  </div>

                  <p className="field-hint">Enter only the amount verified against the actual payment receipt. No amount is suggested where fees need reconciliation.</p>
                  <div className="form-grid">
                    <div className="field">
                      <label>Payment Amount (ZMW) *</label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        required
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label>Payment Method *</label>
                      <select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                        <option value="Bank Deposit">Bank Deposit / Teller</option>
                        <option value="Bank Transfer">Direct Bank Transfer</option>
                        <option value="MTN Mobile Money">MTN Mobile Money</option>
                        <option value="Airtel Money">Airtel Money</option>
                        <option value="Zamtel Kwacha">Zamtel Kwacha</option>
                        <option value="Cash Receipt">Cash Receipt</option>
                      </select>
                    </div>

                    <div className="field full">
                      <label>Receipt / Bank Reference Number *</label>
                      <input
                        required
                        placeholder="E.g. ZNCO-89A12B34 or MTN-20271016-99"
                        value={payReceipt}
                        onChange={e => setPayReceipt(e.target.value)}
                      />
                      <small className="field-hint">Bank deposit slip reference or mobile money transaction ID.</small>
                    </div>

                    <div className="field full">
                      <label>Finance Notes (optional)</label>
                      <textarea
                        rows={2}
                        placeholder="Record teller notes or bank deposit verification details..."
                        value={payNote}
                        onChange={e => setPayNote(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <footer className="modal-page-footer">
                <button type="button" className="btn btn-outline" onClick={() => setRecordingItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={recordingBusy || !payAmount || !payReceipt.trim()}>
                  <Wallet size={16} /> {recordingBusy ? 'Recording Payment…' : 'Confirm & Save Payment'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
