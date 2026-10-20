'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowLeft, Plus, User, GraduationCap, FileText, CheckCircle2} from 'lucide-react';
import {api, PageHeader} from '@/components/Portal';
import type {SubmissionStatus} from '@/lib/types';

export default function NewApplicationPage() {
  const router = useRouter();
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNrc, setNewNrc] = useState('');
  const [newProgramme, setNewProgramme] = useState('');
  const [newFundingMethod, setNewFundingMethod] = useState<'cdf' | 'self_funded'>('cdf');
  const [newDistrict, setNewDistrict] = useState('');
  const [newStatus, setNewStatus] = useState<SubmissionStatus>('submitted');
  const [newNote, setNewNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function createApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newProgramme.trim()) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api<{ok: boolean; id: string; reference: string}>('/api/admin/submissions', {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          phone: newPhone,
          nrc: newNrc,
          programme: newProgramme,
          fundingMethod: newFundingMethod,
          district: newDistrict,
          status: newStatus,
          note: newNote
        })
      });
      setMessage(`Application registered successfully (Reference: ${res.reference})`);
      setTimeout(() => {
        router.push(`/dashboard/applications/${res.id}`);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create application.');
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Register New Application"
        subtitle="Enter student application records directly into the KASA system for offline, walk-in, or sponsored applicants."
        action={
          <Link href="/dashboard/applications" className="btn btn-outline" style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <ArrowLeft size={16} /> Back to Applications
          </Link>
        }
      />

      <div className="panel pad-panel" style={{maxWidth: 900, margin: '0 auto'}}>
        {error && <div className="alert-error" style={{marginBottom: 16}}>{error}</div>}
        {message && <div className="notice" style={{marginBottom: 16}}><CheckCircle2 size={16} /> {message}</div>}

        <form onSubmit={e => void createApplication(e)} style={{display: 'flex', flexDirection: 'column', gap: 24}}>
          <div className="card-box" style={{background: 'var(--panel-bg, #fff)', border: '1px solid var(--border)', borderRadius: 12, padding: 20}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12}}>
              <User size={20} style={{color: 'var(--green)'}} />
              <h2 style={{fontSize: 18, margin: 0}}>1. Applicant Personal Details</h2>
            </div>
            <div className="form-grid">
              <div className="field full">
                <label>Student Full Name *</label>
                <input required placeholder="E.g. Chisamba Mumba" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="field">
                <label>Email Address</label>
                <input type="email" placeholder="student@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
              <div className="field">
                <label>Phone Number</label>
                <input type="tel" placeholder="+260 97..." value={newPhone} onChange={e => setNewPhone(e.target.value)} />
              </div>
              <div className="field">
                <label>NRC / National ID Number</label>
                <input placeholder="123456/10/1" value={newNrc} onChange={e => setNewNrc(e.target.value)} />
              </div>
              <div className="field">
                <label>District / Town</label>
                <input placeholder="E.g. Lusaka, Chibombo, Kitwe" value={newDistrict} onChange={e => setNewDistrict(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card-box" style={{background: 'var(--panel-bg, #fff)', border: '1px solid var(--border)', borderRadius: 12, padding: 20}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12}}>
              <GraduationCap size={20} style={{color: 'var(--green)'}} />
              <h2 style={{fontSize: 18, margin: 0}}>2. Programme & Sponsorship Details</h2>
            </div>
            <div className="form-grid">
              <div className="field full">
                <label>Programme / Course Name *</label>
                <input required placeholder="E.g. General Agriculture Trade Test Level III" value={newProgramme} onChange={e => setNewProgramme(e.target.value)} />
              </div>
              <div className="field">
                <label>Funding Pathway</label>
                <select value={newFundingMethod} onChange={e => setNewFundingMethod(e.target.value as 'cdf' | 'self_funded')}>
                  <option value="cdf">Constituency Development Fund (CDF Sponsorship)</option>
                  <option value="self_funded">Self-Funded / Private Tuition</option>
                </select>
              </div>
              <div className="field">
                <label>Initial Application Status</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as SubmissionStatus)}>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="accepted">Accepted / Conditional Offer</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card-box" style={{background: 'var(--panel-bg, #fff)', border: '1px solid var(--border)', borderRadius: 12, padding: 20}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12}}>
              <FileText size={20} style={{color: 'var(--green)'}} />
              <h2 style={{fontSize: 18, margin: 0}}>3. Internal Review Notes</h2>
            </div>
            <div className="field full">
              <label>Review Notes & Intake Details (optional)</label>
              <textarea rows={4} placeholder="Record any background notes, physical document verification details, or intake references..." value={newNote} onChange={e => setNewNote(e.target.value)} />
            </div>
          </div>

          <div style={{display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8}}>
            <Link href="/dashboard/applications" className="btn btn-outline">
              Cancel
            </Link>
            <button className="btn btn-primary" type="submit" disabled={busy || !newName.trim() || !newProgramme.trim()}>
              <Plus size={16} /> {busy ? 'Registering Application…' : 'Register New Application'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
