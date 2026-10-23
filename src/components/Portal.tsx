'use client';
import {useEffect,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {useRouter,usePathname} from 'next/navigation';
import Link from 'next/link';
import {BarChart3,ChevronLeft,ChevronRight,ClipboardList,FilePlus2,FileCheck,LayoutDashboard,LogOut,Menu,Settings,Users,X,Bell,BookOpen,Newspaper,CalendarDays,Database,User,Wallet} from 'lucide-react';
import {auth,authHeaders,firebaseConfigured,signOutClient} from '@/lib/firebase-client';
import type {Profile} from '@/lib/types';
import {BrandLogo} from '@/components/BrandLogo';
import {invalidateAdminCache, fetchWithSwr, getAdminCache} from '@/lib/admin-cache';

export async function api<T=any>(path:string,init:RequestInit={}):Promise<T>{
 const headers=await authHeaders();
 const method=(init.method||'GET').toUpperCase();
 const response=await fetch(path,{...init,cache:'no-store',headers:{...headers,...(init.body instanceof FormData?{}:{'Content-Type':'application/json'}),...init.headers}});
 const body=await response.json().catch(()=>({error:`The server returned HTTP ${response.status}. Please retry.`}));
 if(!response.ok)throw Error(typeof body.error==='string'?body.error:'The request could not be completed.');
 if(method!=='GET'){
  if(path.includes('/api/admin/content'))invalidateAdminCache('content');
  else if(path.includes('/api/admin/submissions'))invalidateAdminCache('submissions');
  else if(path.includes('/api/admin/forms'))invalidateAdminCache('forms');
  else if(path.includes('/api/admin/intake'))invalidateAdminCache('intake');
  else if(path.includes('/api/admin/agents'))invalidateAdminCache('agents');
  else if(path.includes('/api/admin/commissions'))invalidateAdminCache('commissions');
  else if(path.includes('/api/admin/settings'))invalidateAdminCache('settings');
  else invalidateAdminCache(path);
 }
 return body as T;
}

/**
 * Fast SWR data fetcher: returns cached data immediately (0ms) while revalidating in background.
 */
export async function cachedApi<T=any>(path:string,onUpdate?:(fresh:T)=>void,ttl?:number):Promise<T>{
 return fetchWithSwr<T>(path,()=>api<T>(path),onUpdate,ttl);
}
export function getCachedApiData<T=any>(path:string):T|null{
 return getAdminCache<T>(path);
}
export function Portal({children}:{children:React.ReactNode}){
 const [profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(true),[sessionError,setSessionError]=useState(''),[collapsed,setCollapsed]=useState(false),[mobile,setMobile]=useState(false),[mounted,setMounted]=useState(false);
 const router=useRouter(),path=usePathname();
 useEffect(()=>{
  setMounted(true);
  try{setCollapsed(window.localStorage.getItem('kasa_sidebar_collapsed')==='true');}catch{}
 },[]);
 function toggleSidebar(){setCollapsed(current=>{const next=!current;try{window.localStorage.setItem('kasa_sidebar_collapsed',String(next));}catch{}return next;});}
 useEffect(()=>{setMobile(false);},[path]);
 useEffect(()=>{
  if(!mobile)return;
  const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobile(false);};
  document.addEventListener('keydown',closeOnEscape);
  const previous=document.body.style.overflow;
  document.body.style.overflow='hidden';
  return ()=>{document.removeEventListener('keydown',closeOnEscape);document.body.style.overflow=previous;};
 },[mobile]);
 useEffect(()=>{
  if(!firebaseConfigured||!auth){
   setSessionError('The Firebase sign-in service is not configured for this deployment.');
   setLoading(false);return;
  }
  let active=true;
  const unsubscribe=onAuthStateChanged(auth,async user=>{
   if(!active)return;
   if(!user){setProfile(null);setLoading(false);router.replace('/login?reason=session-ended');return;}
   try{
    const result=await api<{profile:Profile}>('/api/me');
    if(active){
     if(result.profile.role === 'student'){
      router.replace('/my-applications');
      return;
     }
     setProfile(result.profile);
     setSessionError('');
    }
   }catch(e){
    if(active){setProfile(null);setSessionError(e instanceof Error?e.message:'Unable to validate staff access.');}
   }finally{if(active)setLoading(false);}
  },()=>{
   if(active){setProfile(null);setSessionError('Unable to validate your Firebase session.');setLoading(false);}
  });
  return ()=>{active=false;unsubscribe();};
 },[router]);
 async function logOut(){
  try{await signOutClient();setProfile(null);router.replace('/login?reason=session-ended');}
  catch(e){setSessionError(e instanceof Error?e.message:'Unable to sign out. Please retry.');}
 }
 const links=[{name:'Overview',href:'/dashboard',icon:LayoutDashboard},{name:'Notifications',href:'/dashboard/notifications',icon:Bell},
  ...(profile?.role==='agent'?[{name:'My referrals',href:'/dashboard/referrals',icon:Users}]:[{name:'Applications',href:'/dashboard/applications',icon:ClipboardList}]),
  ...(!['super_admin','admin'].includes(profile?.role||'')?[]:[{name:'Website',href:'/dashboard/website',icon:Settings},{name:'Programmes',href:'/dashboard/programmes',icon:BookOpen},{name:'Announcements',href:'/dashboard/announcements',icon:Newspaper},{name:'Intake windows',href:'/dashboard/intake',icon:CalendarDays},{name:'Form builder',href:'/dashboard/forms',icon:FilePlus2},{name:'Acceptance Pack',href:'/dashboard/settings/acceptance-letter',icon:FileCheck},{name:'District agents',href:'/dashboard/agents',icon:Users},{name:'Finance Ledger',href:'/dashboard/finance',icon:Wallet},{name:'Commissions',href:'/dashboard/commissions',icon:BarChart3},{name:'Automations',href:'/dashboard/automations',icon:Bell},{name:'Settings',href:'/dashboard/settings',icon:Settings}]),...(profile?.role==='super_admin'?[{name:'Staff roles',href:'/dashboard/staff',icon:Users},{name:'Data setup',href:'/dashboard/setup',icon:Database},{name:'KASA Life Marathon',href:'/marthon',icon:CalendarDays}]:[]),{name:'My profile',href:'/dashboard/profile',icon:User}];
 if(loading)return <main className="page-loader" role="status">Loading your secure workspace…</main>;
 if(sessionError||!profile)return <main className="portal-error-state" role="alert"><h1>Workspace access needs attention</h1><p>{sessionError||'Sign in with an authorized KASA staff or agent account to continue.'}</p><Link className="btn btn-primary" href="/login">Go to sign in</Link></main>;
 return <div className="portal-shell"><aside id="kasa-admin-navigation" className={`sidebar ${collapsed?'collapsed':''} ${mobile?'mobile-open':''}`}>
  <div className="side-header"><Link href="/dashboard" className="brand"><BrandLogo size={48}/>{(!collapsed||mobile)&&<span><strong>KASA</strong><small>Administration</small></span>}</Link><button className="icon-btn toggle-collapse-top" type="button" onClick={toggleSidebar} title={collapsed?"Expand sidebar":"Collapse sidebar"} aria-label={collapsed?"Expand sidebar":"Collapse sidebar"}><ChevronLeft size={18} style={{transform:collapsed?'rotate(180deg)':undefined}}/></button><button className="icon-btn close-mobile" onClick={()=>setMobile(false)} aria-label="Close menu"><X size={20}/></button></div>
  <div className="side-label">{!collapsed||mobile?'WORKSPACE':'·'}</div><nav className="side-links" aria-label="Administration">{links.map(l=>{const I=l.icon;return <Link key={l.href} title={l.name} className={`side-link ${path===l.href||l.href!=='/dashboard'&&path.startsWith(l.href+'/')?'active':''}`} aria-current={path===l.href||l.href!=='/dashboard'&&path.startsWith(l.href+'/')?'page':undefined} href={l.href} onClick={()=>setMobile(false)}><I size={19}/>{(!collapsed||mobile)&&<span>{l.name}</span>}</Link>})}</nav>
  <div className="side-bottom"><button className="side-link" type="button" onClick={toggleSidebar} aria-label={collapsed?"Expand sidebar":"Collapse sidebar"}><ChevronLeft size={18} style={{transform:collapsed?'rotate(180deg)':undefined}}/>{(!collapsed||mobile)&&'Collapse sidebar'}</button><button className="side-link" onClick={()=>void logOut()}><LogOut size={18}/>{(!collapsed||mobile)&&'Sign out'}</button></div>
 </aside>{mounted&&mobile&&<button className="sidebar-overlay" onClick={()=>setMobile(false)} aria-label="Close menu"/>}<div className="portal-body"><header className="portal-top"><div className="top-title"><button onClick={()=>setMobile(true)} className="icon-btn menu-button" aria-label="Open administration menu" aria-expanded={mobile} aria-controls="kasa-admin-navigation"><Menu size={20}/></button><button onClick={toggleSidebar} className="icon-btn desktop-collapse-button" aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} title={collapsed?"Expand sidebar":"Collapse sidebar"}><Menu size={20}/></button><span>Enrollment Operations</span><ChevronRight size={14}/><span className="muted">{links.find(l=>path.startsWith(l.href)&&l.href!=='/dashboard')?.name||'Overview'}</span></div><Link href="/dashboard/profile" className="avatar-area" title="Manage my profile and account" style={{textDecoration:'none',color:'inherit'}}><span className="role-pill">{profile.role.replace('_',' ')}</span><div className="mini-avatar">{(profile.displayName||profile.email)[0].toUpperCase()}</div><span className="profile-name">{profile.displayName||profile.email}</span></Link></header><div className="portal-main">{children}</div></div></div>;
}
export function PageHeader({title,subtitle,action}:{title:string;subtitle:string;action?:React.ReactNode}){return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>}
export function StatusBadge({status}:{status:string}){return <span className={'status-badge status-'+status}>{status.replaceAll('_',' ')}</span>}
