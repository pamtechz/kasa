'use client';
import {useEffect, useState, useMemo} from 'react';
import {
  Bell, Plus, Search, Trash2, CheckCircle2, AlertTriangle, Info,
  Filter, X, ArrowLeft, Save, ExternalLink, RefreshCw, Eye, EyeOff, Edit
} from 'lucide-react';
import {api, PageHeader} from '@/components/Portal';
import {ConfirmModal} from '@/components/ConfirmModal';

type Notice = {
  id: string;
  event?: string;
  title: string;
  message: string;
  reference?: string;
  recipient?: 'all' | 'admin' | 'reviewer' | 'agent';
  priority?: 'info' | 'important' | 'urgent';
  read?: boolean;
  readBy?: string[];
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
};

export default function Notifications() {
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingNotice, setDeletingNotice] = useState<Notice | null>(null);
  const [confirmingClearRead, setConfirmingClearRead] = useState(false);
  const [selectedNoticeIds, setSelectedNoticeIds] = useState<Set<string>>(new Set());
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<'selected' | 'all' | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read' | 'urgent'>('all');
  const [recipientFilter, setRecipientFilter] = useState<string>('all');

  // Modal page states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [recipient, setRecipient] = useState<'all' | 'admin' | 'reviewer' | 'agent'>('all');
  const [priority, setPriority] = useState<'info' | 'important' | 'urgent'>('info');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api<{notifications: Notice[]}>('/api/notifications');
      setItems(r.notifications);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Keyboard shortcut to close modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modalOpen]);

  function openCreateModal() {
    setEditingNotice(null);
    setTitle('');
    setMessage('');
    setReference('GENERAL');
    setRecipient('all');
    setPriority('info');
    setModalOpen(true);
  }

  function openEditModal(n: Notice) {
    setEditingNotice(n);
    setTitle(n.title);
    setMessage(n.message);
    setReference(n.reference || 'SYSTEM');
    setRecipient(n.recipient || 'all');
    setPriority(n.priority || 'info');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingNotice(null);
  }

  async function handleSaveNotice(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (editingNotice) {
        // Update existing notification
        await api('/api/notifications', {
          method: 'PATCH',
          body: JSON.stringify({
            id: editingNotice.id,
            title: title.trim(),
            message: message.trim(),
            priority
          })
        });
        setNotice('Notification updated successfully.');
      } else {
        // Create new notification
        await api('/api/notifications', {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim(),
            message: message.trim(),
            reference: reference.trim().toUpperCase() || 'BROADCAST',
            recipient,
            priority
          })
        });
        setNotice('Notification broadcasted to network.');
      }
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save notification.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleRead(n: Notice) {
    const nextRead = !n.read;
    try {
      await api('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({id: n.id, read: nextRead})
      });
      setItems(prev => prev.map(item => (item.id === n.id ? {...item, read: nextRead} : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notice status.');
    }
  }

  async function confirmDeleteNotice() {
    if (!deletingNotice) return;
    setBusy(true);
    try {
      await api(`/api/notifications?id=${deletingNotice.id}`, {method: 'DELETE'});
      setItems(prev => prev.filter(item => item.id !== deletingNotice.id));
      setNotice('Notification deleted.');
      setDeletingNotice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notification.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmBulkDeleteNotices() {
    if (!bulkDeleteTarget) return;
    setBusy(true);
    try {
      const idsToDelete = bulkDeleteTarget === 'selected' ? Array.from(selectedNoticeIds) : filtered.map(x => x.id);
      for (const id of idsToDelete) {
        await api(`/api/notifications?id=${id}`, {method: 'DELETE'});
      }
      setNotice(`Successfully deleted ${idsToDelete.length} notification(s).`);
      setSelectedNoticeIds(new Set());
      setBulkDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk delete failed.');
    } finally {
      setBusy(false);
    }
  }

  function toggleSelectNotice(id: string) {
    const next = new Set(selectedNoticeIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedNoticeIds(next);
  }

  async function executeClearReadNotices() {
    setBusy(true);
    try {
      await api('/api/notifications?action=clear_read', {method: 'DELETE'});
      setNotice('Cleared all read notifications.');
      setConfirmingClearRead(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to clear notifications.');
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    return items.filter(n => {
      if (filter === 'unread' && n.read) return false;
      if (filter === 'read' && !n.read) return false;
      if (filter === 'urgent' && n.priority !== 'urgent') return false;
      if (recipientFilter !== 'all' && n.recipient && n.recipient !== recipientFilter) return false;
      if (q.trim()) {
        const query = q.toLowerCase();
        const matchTitle = n.title.toLowerCase().includes(query);
        const matchMsg = n.message.toLowerCase().includes(query);
        const matchRef = (n.reference || '').toLowerCase().includes(query);
        if (!matchTitle && !matchMsg && !matchRef) return false;
      }
      return true;
    });
  }, [items, filter, recipientFilter, q]);

  const stats = useMemo(() => {
    const total = items.length;
    const unread = items.filter(n => !n.read).length;
    const urgent = items.filter(n => n.priority === 'urgent').length;
    return {total, unread, urgent};
  }, [items]);

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Internal broadcasts, review alerts, sponsorship decisions and network updates."
        action={
          <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
            <button className="btn btn-outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={15} /> Refresh
            </button>
            {selectedNoticeIds.size > 0 && (
              <button className="btn btn-outline" onClick={() => setBulkDeleteTarget('selected')} disabled={busy} style={{color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)'}}>
                <Trash2 size={15} /> Delete Selected ({selectedNoticeIds.size})
              </button>
            )}
            {filtered.length > 0 && (
              <button className="btn btn-outline" onClick={() => setBulkDeleteTarget('all')} disabled={busy} style={{color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)'}}>
                <Trash2 size={15} /> Delete All ({filtered.length})
              </button>
            )}
            {stats.total > 0 && (
              <button className="btn btn-outline" onClick={() => setConfirmingClearRead(true)} disabled={busy}>
                <Trash2 size={15} /> Clear read
              </button>
            )}
            <button className="btn btn-primary" onClick={openCreateModal}>
              <Plus size={16} /> Broadcast notice
            </button>
          </div>
        }
      />

      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon blue"><Bell /></div>
          <span>Total notices</span>
          <strong>{loading ? '—' : stats.total}</strong>
          <small>In institutional outbox</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon amber"><AlertTriangle /></div>
          <span>Unread alerts</span>
          <strong>{loading ? '—' : stats.unread}</strong>
          <small>Require attention</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon purple"><Info /></div>
          <span>Urgent notices</span>
          <strong>{loading ? '—' : stats.urgent}</strong>
          <small>Priority broadcasts</small>
        </div>
      </div>

      <div className="panel pad-panel">
        <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16}}>
          <div style={{flex: 1, minWidth: 240, position: 'relative'}}>
            <input
              type="text"
              placeholder="Search notifications by title, reference, or content…"
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{paddingLeft: 34, width: '100%'}}
            />
            <Search size={16} style={{position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)'}} />
          </div>

          <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
            <button
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter('all')}
            >
              All ({stats.total})
            </button>
            <button
              className={`btn btn-sm ${filter === 'unread' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter('unread')}
            >
              Unread ({stats.unread})
            </button>
            <button
              className={`btn btn-sm ${filter === 'urgent' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter('urgent')}
            >
              Urgent ({stats.urgent})
            </button>
            <button
              className={`btn btn-sm ${filter === 'read' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter('read')}
            >
              Read
            </button>
          </div>

          <select
            value={recipientFilter}
            onChange={e => setRecipientFilter(e.target.value)}
            style={{padding: '7px 12px', fontSize: 13, borderRadius: 8, borderColor: 'var(--border)'}}
          >
            <option value="all">Audience: All</option>
            <option value="admin">Audience: Administrators</option>
            <option value="reviewer">Audience: Reviewers</option>
            <option value="agent">Audience: Agents</option>
          </select>
        </div>

        {loading ? (
          <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            {Array.from({length: 3}).map((_, i) => (
              <div key={i} className="skeleton-row" style={{height: 72, borderRadius: 10}} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{padding: '40px 20px', textAlign: 'center'}}>
            <Bell size={36} style={{color: 'var(--muted)', marginBottom: 8, opacity: 0.5}} />
            <p style={{margin: 0, fontWeight: 600}}>No notifications match your current filter.</p>
            <small className="muted">Create a new broadcast or change the status filter above.</small>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            {filtered.map(n => {
              const isUrgent = n.priority === 'urgent';
              const isImportant = n.priority === 'important';
              return (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    gap: 16,
                    padding: '16px 20px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: n.read ? '#ffffff' : 'rgba(16,63,44,0.03)',
                    borderLeft: `5px solid ${isUrgent ? '#ef4444' : isImportant ? '#f59e0b' : 'var(--green)'}`,
                    alignItems: 'flex-start',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedNoticeIds.has(n.id)}
                    onChange={() => toggleSelectNotice(n.id)}
                    aria-label={`Select ${n.title}`}
                    style={{marginTop: 10}}
                  />
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isUrgent ? 'rgba(239,68,68,0.1)' : isImportant ? 'rgba(245,158,11,0.1)' : 'rgba(16,63,44,0.08)',
                      color: isUrgent ? '#ef4444' : isImportant ? '#f59e0b' : 'var(--green)',
                      flexShrink: 0
                    }}
                  >
                    <Bell size={20} />
                  </div>

                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4}}>
                      <strong style={{fontSize: 15, color: 'var(--ink)'}}>{n.title}</strong>
                      {n.priority && (
                        <span
                          className={`tag ${
                            n.priority === 'urgent' ? 'tag-red' : n.priority === 'important' ? 'tag-amber' : 'tag-gray'
                          }`}
                          style={{fontSize: 11, padding: '2px 8px'}}
                        >
                          {n.priority.toUpperCase()}
                        </span>
                      )}
                      {n.recipient && (
                        <span className="tag tag-gray" style={{fontSize: 11, padding: '2px 8px'}}>
                          TO: {n.recipient.toUpperCase()}
                        </span>
                      )}
                      {!n.read && (
                        <span
                          style={{
                            background: 'var(--gold)',
                            color: '#19382c',
                            fontWeight: 700,
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 4
                          }}
                        >
                          NEW
                        </span>
                      )}
                    </div>

                    <p style={{margin: '0 0 8px', fontSize: 14, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap'}}>
                      {n.message}
                    </p>

                    <div style={{display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)'}}>
                      <span>{new Date(n.createdAt).toLocaleString()}</span>
                      {n.reference && <span>· Ref: <strong>{n.reference}</strong></span>}
                      {n.createdBy && <span>· By: {n.createdBy}</span>}
                    </div>
                  </div>

                  <div style={{display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0}}>
                    <button
                      className="icon-btn"
                      title={n.read ? 'Mark as unread' : 'Mark as read'}
                      onClick={() => void toggleRead(n)}
                      aria-label={n.read ? 'Mark as unread' : 'Mark as read'}
                    >
                      {n.read ? <EyeOff size={16} /> : <Eye size={16} style={{color: 'var(--green)'}} />}
                    </button>
                    <button
                      className="icon-btn"
                      title="Edit notification"
                      onClick={() => openEditModal(n)}
                      aria-label="Edit notification"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="icon-btn"
                      style={{color: '#ef4444'}}
                      title="Delete notification"
                      onClick={() => setDeletingNotice(n)}
                      aria-label="Delete notification"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full Modal Page for Broadcast / Edit Notification */}
      {modalOpen && (
        <div className="modal-page-overlay" role="dialog" aria-modal="true">
          <div className="modal-page">
            <header className="modal-page-header">
              <div className="modal-page-title-group">
                <button
                  type="button"
                  className="modal-page-back-btn"
                  onClick={closeModal}
                  aria-label="Back to notifications"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="modal-page-heading">
                  <span className="modal-page-badge">
                    {editingNotice ? 'EDIT NOTIFICATION' : 'NEW BROADCAST'}
                  </span>
                  <h2>{editingNotice ? `Edit: ${editingNotice.title}` : 'Compose System Broadcast'}</h2>
                  <p className="modal-page-sub">
                    Send real-time alerts to administrators, reviewers, or district agents across Zambia.
                  </p>
                </div>
              </div>
              <div className="modal-page-header-actions">
                <button
                  type="button"
                  className="icon-btn modal-page-close-btn"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <form onSubmit={e => void handleSaveNotice(e)} style={{display: 'contents'}}>
              <div className="modal-page-body">
                <div className="modal-page-card">
                  <h3 className="modal-page-card-title">Notification Details</h3>
                  <div className="form-grid">
                    <div className="field">
                      <label>Notification title *</label>
                      <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="E.g. 2027 Admissions CDF Review Notice"
                        required
                      />
                    </div>

                    <div className="field">
                      <label>Target audience</label>
                      <select
                        value={recipient}
                        onChange={e => setRecipient(e.target.value as any)}
                        disabled={Boolean(editingNotice)}
                      >
                        <option value="all">Entire network (All staff & agents)</option>
                        <option value="admin">Administrators only</option>
                        <option value="reviewer">Reviewers & Admissions officers</option>
                        <option value="agent">Attributed district agents</option>
                      </select>
                    </div>

                    <div className="field">
                      <label>Priority level</label>
                      <select
                        value={priority}
                        onChange={e => setPriority(e.target.value as any)}
                      >
                        <option value="info">Info / General Update</option>
                        <option value="important">Important / Action Required</option>
                        <option value="urgent">Urgent / Immediate Attention</option>
                      </select>
                    </div>

                    <div className="field">
                      <label>Reference tag</label>
                      <input
                        type="text"
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                        placeholder="E.g. KASA-INTAKE-2027"
                      />
                    </div>
                  </div>

                  <div className="field" style={{marginTop: 16}}>
                    <label>Broadcast message *</label>
                    <textarea
                      rows={6}
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Type the notification details here. Include instructions, milestones, or deadlines…"
                      required
                    />
                  </div>
                </div>
              </div>

              <footer className="modal-page-footer">
                <div className="modal-page-footer-left">
                  <span className="muted" style={{fontSize: 13}}>
                    Press <strong>Esc</strong> to cancel
                  </span>
                </div>
                <div className="modal-page-footer-actions">
                  <button type="button" className="btn btn-outline" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={busy || !title.trim() || !message.trim()}>
                    <Save size={16} /> {busy ? 'Saving…' : editingNotice ? 'Update notice' : 'Broadcast notice'}
                  </button>
                </div>
              </footer>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingNotice)}
        title="Delete Notification"
        message={`Are you sure you want to delete notice "${deletingNotice?.title}"?`}
        kind="danger"
        confirmLabel="Delete Notice"
        cancelLabel="Cancel"
        busy={busy}
        onConfirm={() => void confirmDeleteNotice()}
        onCancel={() => setDeletingNotice(null)}
      />

      <ConfirmModal
        isOpen={Boolean(bulkDeleteTarget)}
        title="Delete Multiple Notifications"
        message={`Are you sure you want to delete ${bulkDeleteTarget === 'selected' ? `${selectedNoticeIds.size} selected` : `all ${filtered.length}`} notification(s)?`}
        kind="danger"
        confirmLabel="Delete Notifications"
        cancelLabel="Cancel"
        busy={busy}
        onConfirm={() => void confirmBulkDeleteNotices()}
        onCancel={() => setBulkDeleteTarget(null)}
      />

      <ConfirmModal
        isOpen={confirmingClearRead}
        title="Clear Read Notifications"
        message="Are you sure you want to clear all notifications marked as read?"
        kind="danger"
        confirmLabel="Clear Read Notices"
        cancelLabel="Cancel"
        busy={busy}
        onConfirm={() => void executeClearReadNotices()}
        onCancel={() => setConfirmingClearRead(false)}
      />
    </>
  );
}
