'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {PublicApplicationLinks} from '@/components/PublicApplicationLinks';
import {BrandLogo} from '@/components/BrandLogo';
import {HeroSlider} from '@/components/HeroSlider';
import {defaultSite,type SiteSettings} from '@/lib/site';
import {getCachedSite,fetchSiteCached,fetchContentCached} from '@/lib/client-cache';
import type {Programme,Announcement} from '@/lib/content';
import {CheckCircle2,ClipboardList,MapPin,ShieldCheck,Sprout,Users,Menu,X,ArrowRight,Search,Sparkles,BookOpen,CalendarDays,Award,FileText} from 'lucide-react';
import {auth,getClientAuth,firebaseConfigured} from '@/lib/firebase-client';
import {onAuthStateChanged} from 'firebase/auth';

export default function Home(){
 const [site,setSite]=useState<SiteSettings>(getCachedSite()||defaultSite);
 const [navOpen,setNavOpen]=useState(false);
 const [userLoggedIn,setUserLoggedIn]=useState(false);
 const [dashboardHref,setDashboardHref]=useState('/dashboard');
 const [searchQuery,setSearchQuery]=useState('');
 const [activePillar,setActivePillar]=useState<number>(0);
 const [programmes,setProgrammes]=useState<Programme[]>([]);
 const [announcements,setAnnouncements]=useState<Announcement[]>([]);
 const router=useRouter();

 const handleCourseSearch=(e:React.FormEvent)=>{
  e.preventDefault();
  const queryParam=searchQuery.trim()?`?search=${encodeURIComponent(searchQuery.trim())}`:'';
  router.push(`/programmes${queryParam}`);
 };

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

 useEffect(()=>{
  if(!navOpen)return;
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setNavOpen(false);};
  document.addEventListener('keydown',close);
  return ()=>document.removeEventListener('keydown',close);
 },[navOpen]);

 useEffect(()=>{
  const controller=new AbortController();
  void fetchSiteCached(controller.signal).then(s=>{
   if(s)setSite(s);
  });
  fetchContentCached('programmes').then(items=>setProgrammes((items as Programme[]).slice(0,3))).catch(()=>{});
  fetchContentCached('announcements').then(items=>setAnnouncements((items as Announcement[]).slice(0,3))).catch(()=>{});
  return ()=>controller.abort();
 },[]);

 const pillarDetails=[
  {
   title:'Head · Knowledge & Reasoning',
   desc:'Equipping youth with practical technical understanding, commercial agriculture concepts, trade regulations and strategic business management skills.',
   icon:<BookOpen size={24}/>
  },
  {
   title:'Heart · Integrity & Community Leadership',
   desc:'Instilling values of stewardship, team cooperation, ethical agent practices, and community service across all 116 districts in Zambia.',
   icon:<Sprout size={24}/>
  },
  {
   title:'Hand · Practical Vocational Skills',
   desc:'Hands-on trade experience in heavy machinery operations, automotive repairs, cooperative farming, and modern sports facility administration.',
   icon:<Award size={24}/>
  }
 ];

 return <main>
  <div className="hero-shell">
   <nav className="top-nav container"><Link href="/" className="brand"><BrandLogo size={62}/><span><strong>{site.organization}</strong><small>{site.subtitle}</small></span></Link>
    <button type="button" className="icon-btn home-nav-toggle" aria-expanded={navOpen} aria-controls="kasa-home-navigation" aria-label={navOpen?"Close navigation":"Open navigation"} onClick={()=>setNavOpen(v=>!v)}>{navOpen?<X size={24}/>:<Menu size={24}/>}</button>
    <div id="kasa-home-navigation" className={`nav-links home-nav-links ${navOpen?"home-nav-open":""}`}>
     <Link onClick={()=>setNavOpen(false)} href="/about">About</Link><Link onClick={()=>setNavOpen(false)} href="/programmes">Programmes</Link><Link onClick={()=>setNavOpen(false)} href="/fees">Fees</Link><Link onClick={()=>setNavOpen(false)} href="/announcements">News & Blog</Link><Link onClick={()=>setNavOpen(false)} href="/admissions">Admissions</Link><Link onClick={()=>setNavOpen(false)} href="/agents">Agents</Link><Link onClick={()=>setNavOpen(false)} href="/contact">Contact</Link><Link onClick={()=>setNavOpen(false)} href="/my-applications">My applications</Link>{userLoggedIn?<Link onClick={()=>setNavOpen(false)} href={dashboardHref} className="site-login home-dashboard-btn" style={{fontWeight:700,background:'var(--gold)',color:'#19382c',padding:'8px 14px',borderRadius:'8px',display:'inline-flex',alignItems:'center',gap:'6px'}}>Dashboard <ArrowRight size={14}/></Link>:<PublicApplicationLinks placement="nav"/>}
    </div></nav>
   <div className="container hero-grid">
    <div className="hero-copy">
     <HeroSlider site={site}/>

     <form className="hero-course-finder" onSubmit={handleCourseSearch}>
      <div className="finder-input-wrap">
       <Search size={16} className="finder-icon"/>
       <input type="text" placeholder="Search programmes (e.g. Agriculture, Automotive, Heavy Machinery)..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
      </div>
      <button type="submit" className="btn btn-hero-search">Find Course <ArrowRight size={14}/></button>
     </form>

     <div className="hero-metrics">{site.metrics.map((m,i)=><div key={i}><strong>{m.value}</strong><span>{m.label}</span></div>)}</div>
    </div>
    <div className="hero-visual">
     <div className="visual-orbit">
      <div className="circle-icon icon-one"><Users size={30}/></div>
      <div className="circle-icon icon-two"><Sprout size={30}/></div>
      <div className="circle-icon icon-three"><MapPin size={28}/></div>
      <div className="visual-center">
       <div className="small-note">KASA Enrollment Network</div>
       <div className="visual-value">{site.heroCardTitle}</div>
       <p>{site.heroCardDescription}</p>
      </div>
     </div>
     <div className="float-card"><CheckCircle2 size={20}/><span>Official KASA enrollment platform</span></div>
    </div>
   </div>
  </div>

  <section className="trust-strip">
   <div className="container trust-strip-inner">
    <div className="trust-item">
     <ShieldCheck size={22} className="trust-icon"/>
     <div>
      <strong>TEVETA Vocational Standards</strong>
      <span>Practical Skills Testing Alignment</span>
     </div>
    </div>
    <div className="trust-item">
     <CheckCircle2 size={22} className="trust-icon"/>
     <div>
      <strong>Official CDF Sponsorship</strong>
      <span>Government Bursary Verification Pathway</span>
     </div>
    </div>
    <div className="trust-item">
     <Users size={22} className="trust-icon"/>
     <div>
      <strong>116 District Coverage</strong>
      <span>Nationwide Student & Agent Representation</span>
     </div>
    </div>
   </div>
  </section>

  {programmes.length>0&&<section className="container section-pad">
   <div className="section-heading">
    <span className="overline">FEATURED VOCATIONAL COURSES</span>
    <h2>Training Programmes</h2>
    <p>Explore practical training programmes designed for career readiness and entrepreneurship.</p>
   </div>
   <div className="site-cards programmes-grid">
    {programmes.map(p=><article className="site-card programme-card" key={p.id}>
     <div className="card-badge-row">
      <span className="overline tag-green">{p.category.replaceAll('-',' ')}</span>
      <span className="duration-tag"><CalendarDays size={12}/> {p.duration}</span>
     </div>
     <h2>{p.title}</h2>
     <p>{p.description}</p>
     <div className="card-footer-row">
      <div className="fee-badge">
       <strong>{p.fee.tuition!==null?`K${p.fee.tuition.toLocaleString('en-ZM')}`:'Fee pending'}</strong>
       <span>{p.fee.tuition!==null?'Tuition':'Subject to review'}</span>
      </div>
      <div className="card-actions">
       <Link href={'/programmes/'+p.id} className="btn btn-outline-sm">Details</Link>
       <Link href={`/admissions?programme=${p.id}`} className="btn btn-primary-sm">Apply now <ArrowRight size={13}/></Link>
      </div>
     </div>
    </article>)}
   </div>
   <div className="center-action" style={{textAlign:'center',marginTop:'30px'}}>
    <Link href="/programmes" className="btn btn-outline">Explore All Programmes <ArrowRight size={15}/></Link>
   </div>
  </section>}

  <section className="home-cdf-banner">
   <div className="container home-cdf-inner">
    <div className="cdf-copy">
     <span className="overline gold-text">GOVERNMENT SPONSORSHIP</span>
     <h2>Constituency Development Fund (CDF) Fast-Track</h2>
     <p>Applying under CDF sponsorship automatically validates your application and generates an official editable PDF acceptance package. KASA forms and guidance are completely free of charge.</p>
    </div>
    <div className="cdf-actions">
     <Link href="/admissions#cdf" className="btn btn-light">CDF Application Guide <ArrowRight size={16}/></Link>
     <Link href="/agents" className="btn btn-outline-light">Become a District Agent</Link>
    </div>
   </div>
  </section>

  <section id="about" className="container section-pad">
   <div className="section-heading">
    <span className="overline">ABOUT KASA</span>
    <h2>{site.aboutTitle}</h2>
    <p>{site.aboutDescription}</p>
   </div>

   <div className="pillars-switcher">
    <div className="pillar-tabs">
     {site.aboutValues.map((v,i)=><button key={i} type="button" className={`pillar-tab ${activePillar===i?'active':''}`} onClick={()=>setActivePillar(i)}>
      <strong>{v.title}</strong>
      <span>Pillar {i+1}</span>
     </button>)}
    </div>
    <div className="pillar-display site-card">
     <div className="pillar-icon-box">{pillarDetails[activePillar]?.icon||<Sprout size={24}/>}</div>
     <h3>{pillarDetails[activePillar]?.title||site.aboutValues[activePillar]?.title}</h3>
     <p>{pillarDetails[activePillar]?.desc||site.aboutValues[activePillar]?.description}</p>
    </div>
   </div>
  </section>

  {announcements.length>0&&<section className="container section-pad-sm">
   <div className="section-heading">
    <span className="overline">LATEST NEWS & UPDATES</span>
    <h2>Institutional Announcements</h2>
    <p>Stay informed about intake schedules, gazette approvals and district network operations.</p>
   </div>
   <div className="site-cards news-grid">
    {announcements.map(a=><article className="site-card news-card" key={a.id}>
     <div className="card-badge-row">
      <span className="overline tag-green">{a.category}</span>
      {a.publishedAt&&<span className="muted font-xs"><CalendarDays size={11}/> {new Date(a.publishedAt).toLocaleDateString('en-ZM',{month:'short',day:'numeric'})}</span>}
     </div>
     <h2>{a.title}</h2>
     <p>{a.description}</p>
     <div className="card-footer-row">
      <Link href={'/announcements/'+a.id} className="text-link">Read update <ArrowRight size={14}/></Link>
     </div>
    </article>)}
   </div>
   <div style={{textAlign:'center',marginTop:'24px'}}>
    <Link href="/announcements" className="btn btn-outline">View All Announcements <ArrowRight size={15}/></Link>
   </div>
  </section>}

  <section id="how" className="container section-pad"><div className="section-heading"><span className="overline">{site.howEyebrow}</span><h2>{site.howTitle}</h2><p>{site.howDescription}</p></div><div className="three-cols">{site.steps.map((s,i)=><article className="feature" key={i}><span>{i===0?<ClipboardList size={24}/>:i===1?<ShieldCheck size={24}/>:<CheckCircle2 size={24}/>}</span><h3>{i+1}. {s.title}</h3><p>{s.description}</p></article>)}</div></section>
  <PublicApplicationLinks placement="catalog"/>
  <section id="contact" className="container section-pad"><div className="section-heading"><span className="overline">CONTACT</span><h2>{site.contactTitle}</h2><p>{site.contactDescription}</p><div className="contact-actions">{site.contactEmail&&<a className="btn btn-outline" href={'mailto:'+site.contactEmail}>{site.contactEmail}</a>}{site.contactPhone&&<a className="btn btn-outline" href={'tel:'+site.contactPhone}>{site.contactPhone}</a>}</div></div></section>
  <section className="cta-band"><div className="container"><div><span className="overline">{site.ctaEyebrow}</span><h2>{site.ctaTitle}</h2><p>{site.ctaDescription}</p></div><PublicApplicationLinks placement="cta"/></div></section>
  <footer className="footer container"><span className="footer-brand"><BrandLogo size={52}/>{site.footer}</span><span>Head · Heart · Hand</span></footer>
 </main>;
}
