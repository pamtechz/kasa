'use client';

import {useEffect, useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {useRouter, usePathname} from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, PlusCircle, BarChart3, User, LogOut, ChevronLeft, ChevronRight,
  Menu, X, MapPin, Award, Wallet, Share2
} from 'lucide-react';
import {auth, authHeaders, firebaseConfigured, signOutClient} from '@/lib/firebase-client';
import type {Profile} from '@/lib/types';
import {BrandLogo} from '@/components/BrandLogo';

export function AgentPortal({children}: {children: React.ReactNode}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    setMounted(true);
    try {
      setCollapsed(window.localStorage.getItem('kasa_agent_sidebar_collapsed') === 'true');
    } catch {}
  }, []);

  function toggleSidebar() {
    setCollapsed(current => {
      const next = !current;
      try { window.localStorage.setItem('kasa_agent_sidebar_collapsed', String(next)); } catch {}
      return next;
    });
  }

  useEffect(() => { setMobile(false); }, [path]);

  useEffect(() => {
    if (!mobile) return;
    const closeOnEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobile(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobile]);

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setSessionError('The Firebase sign-in service is not configured for this deployment.');
      setLoading(false);
      return;
    }
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!active) return;
      if (!user) {
        setProfile(null);
        setLoading(false);
        router.replace('/login?reason=session-ended');
        return;
      }
      try {
        const headers = await authHeaders();
        const res = await fetch('/api/me', {headers, cache: 'no-store'});
        const data = await res.json();
        if (active) {
          if (res.ok && data.profile) {
            if (data.profile.role !== 'agent' && data.profile.role !== 'super_admin' && data.profile.role !== 'admin') {
              setSessionError('District Agent access required. Sign in with an active agent account.');
            } else {
              setProfile(data.profile);
              setSessionError('');
            }
          } else {
            setSessionError('Unable to load agent profile.');
          }
        }
      } catch (e) {
        if (active) setSessionError(e instanceof Error ? e.message : 'Unable to validate agent access.');
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, [router]);

  async function logOut() {
    try {
      await signOutClient();
      setProfile(null);
      router.replace('/login?reason=session-ended');
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : 'Unable to sign out.');
    }
  }

  const links = [
    {name: 'Agent Portal Overview', href: '/agent-portal', icon: LayoutDashboard},
    {name: 'Register Candidate', href: '/dashboard/applications/new', icon: PlusCircle},
    {name: 'Referred Candidates', href: '/dashboard/referrals', icon: Users},
    {name: 'Commission Ledger', href: '/dashboard/commissions', icon: Wallet},
    {name: 'Agent Profile', href: '/dashboard/profile', icon: User}
  ];

  if (loading) return <main className="page-loader" role="status">Loading agent portal…</main>;

  if (sessionError || !profile) {
    return (
      <main className="portal-error-state" role="alert">
        <h1>District Agent Portal</h1>
        <p>{sessionError || 'Sign in with an active KASA district agent account to continue.'}</p>
        <Link className="btn btn-primary" href="/login">Go to Sign In</Link>
      </main>
    );
  }

  return (
    <div className="portal-shell">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobile ? 'mobile-open' : ''}`}>
        <div className="side-header">
          <Link href="/dashboard" className="brand">
            <BrandLogo size={48} />
            {(!collapsed || mobile) && <span><strong>KASA</strong><small>District Agent</small></span>}
          </Link>
          <button className="icon-btn toggle-collapse-top" type="button" onClick={toggleSidebar} title="Toggle sidebar">
            <ChevronLeft size={18} style={{transform: collapsed ? 'rotate(180deg)' : undefined}} />
          </button>
          <button className="icon-btn close-mobile" onClick={() => setMobile(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="side-label">{!collapsed || mobile ? 'DISTRICT AGENT' : '·'}</div>
        <nav className="side-links">
          {links.map(l => {
            const I = l.icon;
            const active = path === l.href || (l.href !== '/dashboard' && path.startsWith(l.href));
            return (
              <Link
                key={l.href}
                title={l.name}
                className={`side-link ${active ? 'active' : ''}`}
                href={l.href}
                onClick={() => setMobile(false)}
              >
                <I size={19} />
                {(!collapsed || mobile) && <span>{l.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="side-bottom">
          <button className="side-link" type="button" onClick={toggleSidebar}>
            <ChevronLeft size={18} style={{transform: collapsed ? 'rotate(180deg)' : undefined}} />
            {(!collapsed || mobile) && 'Collapse sidebar'}
          </button>
          <button className="side-link" onClick={() => void logOut()}>
            <LogOut size={18} />
            {(!collapsed || mobile) && 'Sign Out'}
          </button>
        </div>
      </aside>

      {mounted && mobile && <button className="sidebar-overlay" onClick={() => setMobile(false)} />}

      <div className="portal-body">
        <header className="portal-top">
          <div className="top-title">
            <button onClick={() => setMobile(true)} className="icon-btn menu-button">
              <Menu size={20} />
            </button>
            <button onClick={toggleSidebar} className="icon-btn desktop-collapse-button">
              <Menu size={20} />
            </button>
            <span>Agent Portal</span>
            <ChevronRight size={14} />
            <span className="muted">{links.find(l => path.startsWith(l.href))?.name || 'Overview'}</span>
          </div>

          <Link href="/dashboard/profile" className="avatar-area" style={{textDecoration: 'none', color: 'inherit'}}>
            <span className="role-pill">District Agent</span>
            <div className="mini-avatar">{(profile.displayName || profile.email)[0].toUpperCase()}</div>
            <span className="profile-name">{profile.displayName || profile.email}</span>
          </Link>
        </header>

        <div className="portal-main">{children}</div>
      </div>
    </div>
  );
}
