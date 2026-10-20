'use client';

import {useState, useEffect} from 'react';
import {StudentPortal} from '@/components/StudentPortal';
import {Bell, RefreshCw, Info, CalendarDays, CheckCircle2} from 'lucide-react';
import {authHeaders} from '@/lib/firebase-client';

type Notice = {
  id: string;
  title: string;
  message: string;
  reference?: string;
  priority?: 'info' | 'important' | 'urgent';
  createdAt: string;
};

export default function StudentNotificationsPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotices = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/notifications', {headers, cache: 'no-store'});
      if (!res.ok) throw new Error('Failed to load notifications.');
      const data = await res.json();
      setNotices(Array.isArray(data.notifications) ? data.notifications : []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotices();
  }, []);

  return (
    <StudentPortal>
      <div className="page-heading">
        <div>
          <h1>Announcements & Institutional Notices</h1>
          <p>Official broadcasts, intake updates, timetable notifications, and sponsorship guidelines for KASA students.</p>
        </div>
        <button className="btn btn-outline" onClick={() => void loadNotices()} disabled={loading} style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="alert-error" style={{marginBottom: 16}}>{error}</div>}

      <div className="panel pad-panel">
        {loading ? (
          <div style={{padding: '30px 20px', textAlign: 'center'}} className="muted">
            Loading announcements…
          </div>
        ) : notices.length === 0 ? (
          <div className="empty-state" style={{padding: '40px 20px', textAlign: 'center'}}>
            <Bell size={36} style={{color: 'var(--muted)', opacity: 0.5, marginBottom: 8}} />
            <p style={{margin: 0, fontWeight: 600}}>No new announcements at this time.</p>
            <small className="muted">Check back later for intake updates and official notices.</small>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            {notices.map(n => (
              <div
                key={n.id}
                style={{
                  background: '#ffffff', padding: '16px 20px', borderRadius: 12,
                  border: '1px solid var(--border)', borderLeft: '4px solid var(--green)'
                }}
              >
                <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6}}>
                  <strong style={{fontSize: 16, color: 'var(--ink)'}}>{n.title}</strong>
                  {n.priority && (
                    <span className={`tag ${n.priority === 'urgent' ? 'tag-red' : 'tag-green'}`} style={{fontSize: 10}}>
                      {n.priority.toUpperCase()}
                    </span>
                  )}
                </div>
                <p style={{margin: '0 0 10px', fontSize: 14, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap'}}>
                  {n.message}
                </p>
                <div style={{fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12, alignItems: 'center'}}>
                  <span><CalendarDays size={12} /> {new Date(n.createdAt).toLocaleDateString('en-GB', {month: 'short', day: 'numeric', year: 'numeric'})}</span>
                  {n.reference && <span>· Ref: {n.reference}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StudentPortal>
  );
}
