'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {Menu,X,ArrowRight} from 'lucide-react';
import {BrandLogo} from '@/components/BrandLogo';
import {defaultSite,type SiteSettings} from '@/lib/site';
import {getCachedSite,fetchSiteCached} from '@/lib/client-cache';
import {auth,getClientAuth,firebaseConfigured} from '@/lib/firebase-client';
import {onAuthStateChanged} from 'firebase/auth';

const links=[['/about','About KASA'],['/programmes','Programmes'],['/fees','Fees'],['/admissions','Admissions'],['/agents','Agents'],['/announcements','News & Blog'],['/contact','Contact']];

export function SiteChrome({children}:{children:React.ReactNode}){
 const [site,setSite]=useState<SiteSettings>(getCachedSite()||defaultSite),[mobile,setMobile]=useState(false);
 const [userLoggedIn,setUserLoggedIn]=useState(false);
 const [dashboardHref,setDashboardHref]=useState('/dashboard');
 const pathname=usePathname();
 useEffect(()=>{
  const controller=new AbortController();
  void fetchSiteCached(controller.signal).then(s=>{if(s)setSite(s);});
  return ()=>controller.abort();
 },[]);
 useEffect(()=>{
  if(!firebaseConfigured)return;
  const clientAuth=getClientAuth()||auth;
  if(!clientAuth)return;
  const unsub=onAuthStateChanged(clientAuth,async user=>{
   if(user){
    setUserLoggedIn(true);
    try{
     const token=await user.getIdToken();
     const res=await fetch('/api/me',{headers:{Authorization:`Bearer ${token}`}});
     const data=await res.json().catch(()=>({}));
     const role=data?.profile?.role;
     if(role==='agent')setDashboardHref('/dashboard/referrals');
     else if(role==='reviewer')setDashboardHref('/dashboard/applications');
     else if(role==='student')setDashboardHref('/my-applications');
     else setDashboardHref('/dashboard');
    }catch{
     setDashboardHref('/dashboard');
    }
   }else{
    setUserLoggedIn(false);
    setDashboardHref('/login');
   }
  });
  return ()=>unsub();
 },[]);
 useEffect(()=>{setMobile(false);},[pathname]);
 useEffect(()=>{
  if(!mobile)return;
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobile(false);};
  document.addEventListener('keydown',close);
  return ()=>document.removeEventListener('keydown',close);
 },[mobile]);
 return <div className="public-root">
 <header className="site-header"><nav className="container site-navigation">
  <Link className="site-identity" href="/"><BrandLogo size={53}/><span><strong>{site.organization}</strong><small>{site.subtitle}</small></span></Link>
  <button type="button" className="icon-btn mobile-site-toggle" aria-controls="kasa-public-menu" aria-label={mobile?'Close navigation':'Open navigation'} aria-expanded={mobile} onClick={()=>setMobile(!mobile)}>{mobile?<X/>:<Menu/>}</button>
  <div id="kasa-public-menu" className={'site-links'+(mobile?' opened':'')}>{links.map(([href,label])=><Link key={href} href={href} onClick={()=>setMobile(false)}>{label}</Link>)}<Link href="/my-applications" onClick={()=>setMobile(false)}>My applications</Link>{userLoggedIn?<Link className="site-login" href={dashboardHref} onClick={()=>setMobile(false)} style={{fontWeight:700,background:'var(--accent)'}}>Dashboard <ArrowRight size={15}/></Link>:<Link className="site-login" href="/login" onClick={()=>setMobile(false)}>Sign in <ArrowRight size={15}/></Link>}</div>
 </nav></header>
 {children}
 <footer className="site-footer"><div className="container site-footer-inner"><div><Link className="site-identity" href="/"><BrandLogo size={58}/><span><strong>{site.organization}</strong><small>{site.subtitle}</small></span></Link><p>Head · Heart · Hand</p></div><div className="site-footer-nav">{links.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</div></div><div className="container site-copyright"><div className="inline-form"><Link href="/privacy">Privacy notice</Link><Link href="/terms">Application terms</Link></div>© {new Date().getFullYear()} {site.organization} · Official information and applications</div></footer>
 </div>;
}
export function PageIntro({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){
 return <div className="site-page-hero"><div className="container"><span className="overline">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div>;
}
