'use client';

import {useEffect, useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {useRouter, usePathname} from 'next/navigation';
import Link from 'next/link';
import {AccountMenu} from '@/components/AccountMenu';
import {
  ClipboardList, Share2, Bell, User, ChevronLeft, ChevronRight,
  Menu, X, ShieldCheck, Download, FileText, LockKeyhole
} from 'lucide-react';
import {auth, authHeaders, firebaseConfigured, signOutClient} from '@/lib/firebase-client';
import type {Profile} from '@/lib/types';
import {BrandLogo} from '@/components/BrandLogo';

export function StudentPortal({children}: {children: React.ReactNode}) {
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
      setCollapsed(window.localStorage.getItem('kasa_student_sidebar_collapsed') === 'true');
    } catch {}
  }, []);

  function toggleSidebar() {
    setCollapsed(current => {
      const next = !current;
      try { window.localStorage.setItem('kasa_student_sidebar_collapsed', String(next)); } catch {}
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
            if(data.profile.role!=='student'){
              setProfile(null);
              router.replace(data.profile.role==='marathon_only'?'/marathon':'/dashboard');
              return;
            }
            setProfile(data.profile);
            setSessionError('');
          } else {
            setSessionError('Unable to load your student profile.');
          }
        }
      } catch (e) {
        if (active) setSessionError(e instanceof Error ? e.message : 'Unable to validate student access.');
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
    {name: 'Portal Overview', href: '/student-portal', icon: ClipboardList},
    {name: 'Applications & Documents', href: '/student-portal/applications', icon: FileText},
    {name: 'Refer & Earn Program', href: '/student-portal/referrals', icon: Share2},
    {name: 'Announcements', href: '/student-portal/notifications', icon: Bell},
    {name: 'My Profile & Security', href: '/student-portal/profile', icon: User}
  ];

  if (loading) return <main className="page-loader" role="status">Loading student portal…</main>;

  if (sessionError || !profile) {
    return (
      <main className="portal-error-state" role="alert">
        <h1>Student Portal Access Required</h1>
        <p>{sessionError || 'Sign in with your verified student account to continue.'}</p>
        <Link className="btn btn-primary" href="/login">Go to Sign In</Link>
      </main>
    );
  }

  return (
    <div className="portal-shell">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobile ? 'mobile-open' : ''}`}>
        <div className="side-header">
          <Link href="/my-applications" className="brand">
            <BrandLogo size={48} />
            {(!collapsed || mobile) && <span><strong>KASA</strong><small>Student Portal</small></span>}
          </Link>
          <button className="icon-btn toggle-collapse-top" type="button" onClick={toggleSidebar} title="Toggle sidebar">
            <ChevronLeft size={18} style={{transform: collapsed ? 'rotate(180deg)' : undefined}} />
          </button>
          <button className="icon-btn close-mobile" onClick={() => setMobile(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="side-label">{!collapsed || mobile ? 'STUDENT PORTAL' : '·'}</div>
        <nav className="side-links">
          {links.map(l => {
            const I = l.icon;
            const active = path === l.href || (l.href !== '/my-applications' && path.startsWith(l.href));
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
            <span>Student Portal</span>
            <ChevronRight size={14} />
            <span className="muted">{links.find(l => path.startsWith(l.href))?.name || 'My Applications'}</span>
          </div>

          <AccountMenu displayName={profile.displayName||profile.email} email={profile.email} roleLabel="Student" profileHref="/student-portal/profile" onSignOut={logOut}/>
        </header>

        <div className="portal-main">{children}</div>
      </div>
    </div>
  );
}
