'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {Menu,X,ArrowRight,Phone,Mail,Clock,Shield,Users,User} from 'lucide-react';
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
     else if(role==='marathon_only')setDashboardHref('/marathon');
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

 const phone=site.contactPhone||'+260-97-173-5679';
 const email=site.contactEmail||'admissions@kasa.edu.zm';

 return <div className="public-root">
 <header className="site-header">
  <div className="site-topbar">
   <div className="container site-topbar-inner">
    <div className="topbar-info">
     <a href={`tel:${phone}`}><Phone size={13}/><span>{phone}</span></a>
     <a href={`mailto:${email}`}><Mail size={13}/><span>{email}</span></a>
     <span><Clock size={13}/><span>Mon-Fri: 08:00 - 17:00</span></span>
    </div>
    <div className="topbar-links">
     <Link href="/admissions#cdf"><Shield size={13}/><span>CDF Assistance</span></Link>
     <Link href="/agents"><Users size={13}/><span>Agent Network</span></Link>
     <Link href="/my-applications"><User size={13}/><span>Student Portal</span></Link>
    </div>
   </div>
  </div>
  <nav className="container site-navigation">
   <Link className="site-identity" href="/"><BrandLogo size={53}/><span><strong>{site.organization}</strong><small>{site.subtitle}</small></span></Link>
   <button type="button" className="icon-btn mobile-site-toggle" aria-controls="kasa-public-menu" aria-label={mobile?'Close navigation':'Open navigation'} aria-expanded={mobile} onClick={()=>setMobile(!mobile)}>{mobile?<X/>:<Menu/>}</button>
   <div id="kasa-public-menu" className={'site-links'+(mobile?' opened':'')}>{links.map(([href,label])=>{
    const isActive=pathname===href||(href!=='/'&&pathname.startsWith(href));
    return <Link key={href} href={href} className={isActive?'active':''} onClick={()=>setMobile(false)}>{label}</Link>;
   })}
   {userLoggedIn?<>
    {dashboardHref!=='/marathon'&&<Link href="/my-applications" className={pathname==='/my-applications'?'active':''} onClick={()=>setMobile(false)}>My applications</Link>}
    <Link className="site-login" href={dashboardHref} onClick={()=>setMobile(false)} style={{fontWeight:700,background:'var(--gold)',color:'#19382c'}}>Dashboard <ArrowRight size={15}/></Link>
   </>:<>
    <Link href="/login" onClick={()=>setMobile(false)}>Sign in</Link>
    <Link className="site-login" href="/login" onClick={()=>setMobile(false)} style={{fontWeight:700,background:'var(--gold)',color:'#19382c'}}>Apply Now <ArrowRight size={15}/></Link>
   </>}</div>
  </nav>
 </header>
 {children}
 <footer className="site-footer"><div className="container site-footer-inner"><div><Link className="site-identity" href="/"><BrandLogo size={58}/><span><strong>{site.organization}</strong><small>{site.subtitle}</small></span></Link><p>Head · Heart · Hand</p></div><div className="site-footer-nav">{links.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</div></div><div className="container site-copyright"><div className="inline-form"><Link href="/privacy">Privacy notice</Link><Link href="/terms">Application terms</Link></div>© {new Date().getFullYear()} {site.organization} · Official information and applications</div></footer>
 </div>;
}
export function PageIntro({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){
 return <div className="site-page-hero"><div className="container"><span className="overline">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div>;
}
