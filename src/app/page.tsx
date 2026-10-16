'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {PublicApplicationLinks} from '@/components/PublicApplicationLinks';
import {BrandLogo} from '@/components/BrandLogo';
import {defaultSite,type SiteSettings} from '@/lib/site';
import {CheckCircle2,ClipboardList,MapPin,ShieldCheck,Sprout,Users,Menu,X} from 'lucide-react';

export default function Home(){
 const [site,setSite]=useState<SiteSettings>(defaultSite);
 const [navOpen,setNavOpen]=useState(false);
 useEffect(()=>{
  if(!navOpen)return;
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setNavOpen(false);};
  document.addEventListener('keydown',close);
  return ()=>document.removeEventListener('keydown',close);
 },[navOpen]);
 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/api/public/site',{signal:controller.signal}).then(r=>r.ok?r.json():null)
   .then(d=>{if(d?.site)setSite(d.site as SiteSettings);})
   .catch(()=>{});
  return ()=>controller.abort();
 },[]);
 return <main>
  <div className="hero-shell">
   <nav className="top-nav container"><Link href="/" className="brand"><BrandLogo size={62}/><span><strong>{site.organization}</strong><small>{site.subtitle}</small></span></Link>
    <button type="button" className="icon-btn home-nav-toggle" aria-expanded={navOpen} aria-controls="kasa-home-navigation" aria-label={navOpen?"Close navigation":"Open navigation"} onClick={()=>setNavOpen(v=>!v)}>{navOpen?<X size={24}/>:<Menu size={24}/>}</button>
    <div id="kasa-home-navigation" className={`nav-links home-nav-links ${navOpen?"home-nav-open":""}`}>
     <Link onClick={()=>setNavOpen(false)} href="/about">About</Link><Link onClick={()=>setNavOpen(false)} href="/programmes">Programmes</Link><Link onClick={()=>setNavOpen(false)} href="/fees">Fees</Link><Link onClick={()=>setNavOpen(false)} href="/announcements">Announcements</Link><Link onClick={()=>setNavOpen(false)} href="/admissions">Admissions</Link><Link onClick={()=>setNavOpen(false)} href="/agents">Agents</Link><Link onClick={()=>setNavOpen(false)} href="/contact">Contact</Link><Link onClick={()=>setNavOpen(false)} href="/my-applications">My applications</Link><Link onClick={()=>setNavOpen(false)} href="/login">Staff login</Link><PublicApplicationLinks placement="nav"/>
    </div></nav>
   <div className="container hero-grid"><div className="hero-copy">
    <div className="eyebrow"><span className="pulse-dot"/>{site.badge}</div>
    <h1>{site.heroTitle} <em>{site.heroEmphasis}</em></h1><p>{site.heroDescription}</p>
    <PublicApplicationLinks placement="hero"/>
    <div className="hero-metrics">{site.metrics.map((m,i)=><div key={i}><strong>{m.value}</strong><span>{m.label}</span></div>)}</div>
   </div><div className="hero-visual"><div className="visual-orbit"><div className="circle-icon icon-one"><Users size={30}/></div><div className="circle-icon icon-two"><Sprout size={30}/></div><div className="circle-icon icon-three"><MapPin size={28}/></div><div className="visual-center"><div className="small-note">KASA Enrollment Network</div><div className="visual-value">{site.heroCardTitle}</div><p>{site.heroCardDescription}</p></div></div><div className="float-card"><CheckCircle2 size={20}/><span>Official KASA enrollment platform</span></div></div></div>
  </div>
  <section id="about" className="container section-pad"><div className="section-heading"><span className="overline">ABOUT KASA</span><h2>{site.aboutTitle}</h2><p>{site.aboutDescription}</p></div><div className="three-cols">{site.aboutValues.map((v,i)=><article className="feature" key={i}><span><Sprout size={24}/></span><h3>{v.title}</h3><p>{v.description}</p></article>)}</div></section>
  <section id="how" className="container section-pad"><div className="section-heading"><span className="overline">{site.howEyebrow}</span><h2>{site.howTitle}</h2><p>{site.howDescription}</p></div><div className="three-cols">{site.steps.map((s,i)=><article className="feature" key={i}><span>{i===0?<ClipboardList size={24}/>:i===1?<ShieldCheck size={24}/>:<CheckCircle2 size={24}/>}</span><h3>{i+1}. {s.title}</h3><p>{s.description}</p></article>)}</div></section>
  <div className="container section-pad-sm"><div className="inline-form"><Link className="btn btn-outline" href="/programmes">Browse courses</Link><Link className="btn btn-outline" href="/announcements">Latest announcements</Link><Link className="btn btn-outline" href="/agents">District agent programme</Link></div></div><PublicApplicationLinks placement="catalog"/>
  <section id="contact" className="container section-pad"><div className="section-heading"><span className="overline">CONTACT</span><h2>{site.contactTitle}</h2><p>{site.contactDescription}</p><div className="contact-actions">{site.contactEmail&&<a className="btn btn-outline" href={'mailto:'+site.contactEmail}>{site.contactEmail}</a>}{site.contactPhone&&<a className="btn btn-outline" href={'tel:'+site.contactPhone}>{site.contactPhone}</a>}</div></div></section>
  <section className="cta-band"><div className="container"><div><span className="overline">{site.ctaEyebrow}</span><h2>{site.ctaTitle}</h2><p>{site.ctaDescription}</p></div><PublicApplicationLinks placement="cta"/></div></section>
  <footer className="footer container"><span className="footer-brand"><BrandLogo size={52}/>{site.footer}</span><span>Head · Heart · Hand</span></footer>
 </main>;
}
