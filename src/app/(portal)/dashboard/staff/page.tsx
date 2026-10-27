'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {Plus, ShieldCheck, Trash2, UserPlus, CheckCircle2, Edit3, Search, Filter} from 'lucide-react';
import {api, PageHeader} from '@/components/Portal';
import {ConfirmModal} from '@/components/ConfirmModal';

type UserItem = {
  uid: string;
  email: string;
  displayName: string;
  role: 'super_admin' | 'admin' | 'reviewer' | 'agent' | 'student';
  active: boolean;
  phone?: string;
  district?: string;
  agentCode?: string;
  mustChangePassword?: boolean;
};

export default function UserAndStaffManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // User Provisioning States
  const [provEmail, setProvEmail] = useState('');
  const [provName, setProvName] = useState('');
  const [provRole, setProvRole] = useState<'student' | 'agent' | 'admin' | 'reviewer'>('student');
  const [provDistrict, setProvDistrict] = useState('');
  const [provPhone, setProvPhone] = useState('');
  const [provResult, setProvResult] = useState<{email: string; displayName: string; role: string; agentCode?: string; verificationPending?:boolean;onboardingEmailSent?:boolean} | null>(null);

  // Deleting User Modal States
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const url = roleFilter !== 'all' ? `/api/admin/users?role=${roleFilter}` : '/api/admin/users';
      const r = await api<{users: UserItem[]}>(url);
      setUsers(Array.isArray(r.users) ? r.users : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  async function provisionUser(e: React.FormEvent) {
    e.preventDefault();
    if (!provEmail.trim() || !provName.trim()) return;
    setBusy(true); setError(''); setNotice(''); setProvResult(null);
    try {
      const res = await api<{ok: boolean; email: string; displayName: string; role: string; agentCode?: string; message: string;verificationPending?:boolean;onboardingEmailSent?:boolean}>('/api/admin/users/provision', {
        method: 'POST',
        body: JSON.stringify({
          email: provEmail,
          displayName: provName,
          role: provRole,
          district: provDistrict,
          phone: provPhone
        })
      });
      setProvResult(res);
      setNotice(res.message);
      setProvEmail(''); setProvName(''); setProvDistrict(''); setProvPhone('');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provisioning failed.');
    } finally { setBusy(false); }
  }

  async function confirmDeleteUser() {
    if (!deletingUser) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/api/admin/users/${deletingUser.uid}`, {method: 'DELETE'});
      setNotice(`User account ${deletingUser.displayName} (${deletingUser.email}) permanently deleted.`);
      setDeletingUser(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deletion failed.');
    } finally {
      setBusy(false);
    }
  }

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(u.displayName || '').toLowerCase().includes(q) ||
      String(u.email || '').toLowerCase().includes(q) ||
      String(u.phone || '').toLowerCase().includes(q) ||
      String(u.district || '').toLowerCase().includes(q) ||
      String(u.agentCode || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <PageHeader
        title="User & Staff Account Management"
        subtitle="Register accounts, manage School roles and staff access. Marathon membership uses the same Firebase account."
      />

      {/* 1. Account Provisioning Section */}
      <section className="panel pad-panel" style={{borderLeft: '4px solid var(--green, #103f2c)', marginBottom: 24}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12}}>
          <UserPlus size={20} style={{color: 'var(--green)'}} />
          <h2 style={{margin: 0, fontSize: 18}}>Register or Update School Account (Student, Agent or Staff)</h2>
        </div>
        <p className="muted" style={{fontSize: 13, marginBottom: 16}}>
          Create a School account directly, or assign a School role to an existing account. New users receive password setup instructions where Firebase email delivery is configured and must verify their own email. Accounts use the same sign-in across School and Marathon.
        </p>

        <form onSubmit={e => void provisionUser(e)}>
          <div className="form-grid" style={{marginBottom: 16}}>
            <div className="field">
              <label>Full Name *</label>
              <input required placeholder="E.g. Natasha Chileshe" value={provName} onChange={e => setProvName(e.target.value)} />
            </div>
            <div className="field">
              <label>Email Address *</label>
              <input required type="email" placeholder="user@example.com" value={provEmail} onChange={e => setProvEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Portal Role *</label>
              <select value={provRole} onChange={e => setProvRole(e.target.value as any)}>
                <option value="student">Student (Student Portal)</option>
                <option value="agent">District Agent (Agent Portal)</option>
                <option value="reviewer">Application Reviewer</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div className="field">
              <label>Assigned District (for Agents)</label>
              <input placeholder="E.g. Lusaka, Chisamba" value={provDistrict} onChange={e => setProvDistrict(e.target.value)} />
            </div>
            <div className="field full">
              <label>Phone Number (optional)</label>
              <input type="tel" placeholder="+260 97X XXX XXX" value={provPhone} onChange={e => setProvPhone(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || !provEmail.trim() || !provName.trim()}>
            <UserPlus size={16} /> {busy ? 'Provisioning…' : 'Provision Account'}
          </button>
        </form>

        {provResult && (
          <div style={{background: '#f0f8f3', border: '1px dashed var(--green)', padding: 16, borderRadius: 12, marginTop: 16}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: 'var(--green)', fontWeight: 700}}>
              <CheckCircle2 size={18} />
              <span>Account Provisioned for {provResult.displayName} ({provResult.role.toUpperCase()})</span>
            </div>
            <div style={{fontSize: 13, lineHeight: 1.6, color: 'var(--ink)'}}>
              Email: <strong>{provResult.email}</strong><br />
              {provResult.agentCode && <>Unique Referral Code: <strong>{provResult.agentCode}</strong><br /></>}
              <small className="muted">{provResult.verificationPending ? 'The new user must set their password (check email or use Forgot password), verify their address, and then sign in at' : 'The user can sign in with their own verified credentials at'} <Link href="/login" style={{textDecoration: 'underline', fontWeight: 700}}>KASA Login</Link>. Password recovery remains under their control.</small>
            </div>
          </div>
        )}

        {error && <div className="alert-error" style={{marginTop: 12}}>{error}</div>}
        {notice && !provResult && <div className="notice" style={{marginTop: 12}}>{notice}</div>}
      </section>

      {/* 2. Registered Users Table & Management */}
      <section className="panel">
        <div className="panel-title" style={{flexWrap: 'wrap', gap: 12}}>
          <div>
            <h2>Registered System Accounts</h2>
            <p>Open a dedicated account page to edit profile and role. Only the super administrator can initiate another member&apos;s password reset email.</p>
          </div>
          <div className="table-controls" style={{margin: 0, padding: 0, background: 'transparent', border: 'none'}}>
            <label className="search-box">
              <Search size={16} />
              <input placeholder="Search users by name, email, code or district…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </label>
            <label className="filter-select">
              <Filter size={16} />
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="agent">District Agents</option>
                <option value="reviewer">Reviewers</option>
                <option value="admin">Administrators</option>
                <option value="super_admin">Super Admins</option>
              </select>
            </label>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>User Name</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>District / Code</th>
                <th>Status</th>
                <th>Admin Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="empty-state">Loading system accounts…</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No user accounts found matching your search.</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.uid}>
                    <td>
                      <strong>{u.displayName || 'User'}</strong>
                      {u.phone && <small className="table-sub">{u.phone}</small>}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`tag ${u.role === 'super_admin' ? 'tag-purple' : u.role === 'admin' ? 'tag-blue' : u.role === 'agent' ? 'tag-green' : 'tag-gray'}`}>
                        {u.role.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {u.agentCode ? <code>{u.agentCode}</code> : u.district || '—'}
                    </td>
                    <td>
                      <span className={`tag ${u.active !== false ? 'tag-green' : 'tag-red'}`}>
                        {u.active !== false ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      {u.role === 'super_admin' ? (
                        <span className="muted" style={{fontSize: 12}}>Protected</span>
                      ) : (
                        <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                          <Link className="text-link" href={'/dashboard/staff/'+encodeURIComponent(u.uid)+'/edit'} style={{display:'inline-flex',alignItems:'center',gap:4}}>
                            <Edit3 size={14}/> Edit account
                          </Link>
                          <button
                            type="button"
                            className="text-link"
                            style={{color: '#ef4444'}}
                            onClick={() => setDeletingUser(u)}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* CONFIRM DELETE USER MODAL */}
      <ConfirmModal
        isOpen={Boolean(deletingUser)}
        title="Delete User Account"
        message={`Are you sure you want to permanently delete ${deletingUser?.displayName} (${deletingUser?.email})? This deletes their profile and Firebase Auth account.`}
        kind="danger"
        confirmLabel="Delete User Account"
        cancelLabel="Cancel"
        onConfirm={() => void confirmDeleteUser()}
        onCancel={() => setDeletingUser(null)}
      />
    </>
  );
}
