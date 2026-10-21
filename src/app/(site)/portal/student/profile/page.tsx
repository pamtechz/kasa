'use client';

import {useState, useEffect} from 'react';
import {StudentPortal} from '@/components/StudentPortal';
import {User, Save, LockKeyhole, CheckCircle2, ShieldCheck} from 'lucide-react';
import {authHeaders} from '@/lib/firebase-client';
import {PasswordInput} from '@/components/PasswordInput';

export default function StudentProfilePage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [address, setAddress] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [passBusy, setPassBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [passMessage, setPassMessage] = useState('');
  const [error, setError] = useState('');

  const loadProfile = async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/profile', {headers, cache: 'no-store'});
      const data = await res.json();
      if (res.ok && data.profile) {
        setDisplayName(data.profile.displayName || '');
        setEmail(data.profile.email || '');
        setPhone(data.profile.phone || '');
        setDistrict(data.profile.district || '');
        setProvince(data.profile.province || '');
        setAddress(data.profile.address || '');
      }
    } catch {}
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {...headers, 'Content-Type': 'application/json'},
        body: JSON.stringify({
          displayName,
          phone,
          district,
          province,
          address
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profile update failed.');
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudentPortal>
      <div className="page-heading">
        <div>
          <h1>My Profile & Account Security</h1>
          <p>Manage your personal contact details, residential address, and account security credentials.</p>
        </div>
      </div>

      {error && <div className="alert-error" style={{marginBottom: 16}}>{error}</div>}
      {message && <div className="notice" style={{marginBottom: 16}}><CheckCircle2 size={16} /> {message}</div>}

      <div className="editor-grid">
        {/* Left Column: Personal Info Form */}
        <div className="panel pad-panel">
          <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12}}>
            <User size={20} style={{color: 'var(--green)'}} />
            <h2 style={{fontSize: 18, margin: 0}}>Personal Contact Details</h2>
          </div>

          <form onSubmit={e => void saveProfile(e)} className="form-grid">
            <div className="field full">
              <label>Full Name *</label>
              <input required value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className="field full">
              <label>Verified Email Address</label>
              <input disabled value={email} style={{background: '#f8faf9', color: 'var(--muted)'}} />
              <small className="field-hint">Email address cannot be changed directly.</small>
            </div>
            <div className="field">
              <label>Mobile Phone Number</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+260 97..." />
            </div>
            <div className="field">
              <label>District / Town</label>
              <input value={district} onChange={e => setDistrict(e.target.value)} placeholder="E.g. Lusaka, Chisamba" />
            </div>
            <div className="field full">
              <label>Province</label>
              <input value={province} onChange={e => setProvince(e.target.value)} placeholder="E.g. Lusaka Province, Central Province" />
            </div>
            <div className="field full">
              <label>Residential / Postal Address</label>
              <textarea rows={3} value={address} onChange={e => setAddress(e.target.value)} placeholder="Enter full residential address..." />
            </div>

            <div style={{marginTop: 12}}>
              <button className="btn btn-primary" type="submit" disabled={busy || !displayName.trim()}>
                <Save size={16} /> {busy ? 'Saving Profile…' : 'Save Profile Details'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Security & Role Information */}
        <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
          <div className="panel pad-panel">
            <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12}}>
              <ShieldCheck size={20} style={{color: 'var(--green)'}} />
              <h2 style={{fontSize: 18, margin: 0}}>Account Security & Verification</h2>
            </div>

            <div style={{background: '#f8faf9', padding: 16, borderRadius: 10, border: '1px solid var(--border)'}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
                <span className="muted" style={{fontSize: 13}}>Role Status:</span>
                <span className="tag tag-green">VERIFIED STUDENT</span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
                <span className="muted" style={{fontSize: 13}}>Email Verification:</span>
                <span className="tag tag-green">✓ VERIFIED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StudentPortal>
  );
}
