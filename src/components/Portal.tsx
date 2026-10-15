'use client';
import {useEffect,useState} from 'react';
import {onAuthStateChanged,signOut} from 'firebase/auth';
import {useRouter,usePathname} from 'next/navigation';
import Link from 'next/link';
import {BarChart3,ChevronLeft,ChevronRight,ClipboardList,FilePlus2,LayoutDashboard,LogOut,Menu,Settings,Users,X} from 'lucide-react';
import {auth,authHeaders} from '@/lib/firebase-client';
import type {Profile} from '@/lib/types';
export async function api<T=any>(path:string,init:RequestInit={}):Promise<T>{
 const headers=await authHeaders();
 const response=await fetch(path,{...init,cache:'no-store',headers:{...headers,...(init.body instanceof FormData?{}:{'Content-Type':'application/json'}),...init.headers}});
 const body=await response.json();if(!response.ok)throw Error(body.error||'Request failed.');return body as T;
}
export function Portal({children}:{children:React.ReactNode}){
 const [profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(true),[collapsed,setCollapsed]=useState(false),[mobile,setMobile]=useState(false);
 const router=useRouter(),path=usePathname();
 useEffect(()=>onAuthStateChanged(auth,async user=>{
  if(!user){router.replace('/login');return;}
  try{const r=await api<{profile:Profile}>('/api/me');setProfile(r.profile);}catch{router.replace('/login');}finally{setLoading(false);}
 }),[router]);
 const links=[{name:'Overview',href:'/dashboard',icon:LayoutDashboard},{name:'Applications',href:'/dashboard/applications',icon:ClipboardList},
  ...(!['super_admin','admin'].includes(profile?.role||'')?[]:[{name:'Form builder',href:'/dashboard/forms',icon:FilePlus2},{name:'District agents',href:'/dashboard/agents',icon:Users},{name:'Settings',href:'/dashboard/settings',icon:Settings}])];
 if(loading||!profile)return <main className="page-loader">Loading secure workspace…</main>;
 return <div className="portal-shell"><aside className={`sidebar ${collapsed?'collapsed':''} ${mobile?'mobile-open':''}`}>
  <div className="side-header"><Link href="/dashboard" className="brand"><span className="brand-mark">K</span>{!collapsed&&<span><strong>KASA</strong><small>Administration</small></span>}</Link><button className="icon-btn close-mobile" onClick={()=>setMobile(false)} aria-label="Close menu"><X size={20}/></button></div>
  <div className="side-label">{!collapsed?'WORKSPACE':'·'}</div><nav className="side-links">{links.map(l=>{const I=l.icon;return <Link key={l.href} title={l.name} className={`side-link ${path===l.href||l.href!=='/dashboard'&&path.startsWith(l.href+'/')?'active':''}`} href={l.href} onClick={()=>setMobile(false)}><I size={19}/>{!collapsed&&<span>{l.name}</span>}</Link>})}</nav>
  <div className="side-bottom"><button className="side-link" onClick={()=>setCollapsed(s=>!s)}><ChevronLeft size={18} style={{transform:collapsed?'rotate(180deg)':undefined}}/>{!collapsed&&'Collapse sidebar'}</button><button className="side-link" onClick={()=>void signOut(auth).then(()=>router.replace('/login'))}><LogOut size={18}/>{!collapsed&&'Sign out'}</button></div>
 </aside>{mobile&&<button className="sidebar-overlay" onClick={()=>setMobile(false)} aria-label="Close menu"/>}<div className="portal-body"><header className="portal-top"><div className="top-title"><button onClick={()=>setMobile(true)} className="icon-btn menu-button" aria-label="Open menu"><Menu size={20}/></button><span>Enrollment Operations</span><ChevronRight size={14}/><span className="muted">{links.find(l=>path.startsWith(l.href)&&l.href!=='/dashboard')?.name||'Overview'}</span></div><div className="avatar-area"><span className="role-pill">{profile.role.replace('_',' ')}</span><div className="mini-avatar">{(profile.displayName||profile.email)[0].toUpperCase()}</div><span className="profile-name">{profile.displayName||profile.email}</span></div></header><div className="portal-main">{children}</div></div></div>;
}
export function PageHeader({title,subtitle,action}:{title:string;subtitle:string;action?:React.ReactNode}){return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>}
export function StatusBadge({status}:{status:string}){return <span className={'status-badge status-'+status}>{status.replaceAll('_',' ')}</span>}
