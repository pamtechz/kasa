'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Menu,X,ArrowRight} from 'lucide-react';
import {BrandLogo} from '@/components/BrandLogo';
import {defaultSite,type SiteSettings} from '@/lib/site';
const links=[['/about','About KASA'],['/programmes','Programmes'],['/fees','Fees'],['/admissions','Admissions'],['/agents','Agents'],['/announcements','Announcements'],['/contact','Contact']];
export function SiteChrome({children}:{children:React.ReactNode}){
 const [site,setSite]=useState<SiteSettings>(defaultSite),[mobile,setMobile]=useState(false);
 useEffect(()=>{fetch('/api/public/site').then(r=>r.ok?r.json():null).then(d=>{if(d?.site)setSite(d.site)}).catch(()=>{});},[]);
 return <div className="public-root">
 <header className="site-header"><nav className="container site-navigation">
  <Link className="site-identity" href="/"><BrandLogo size={53}/><span><strong>{site.organization}</strong><small>{site.subtitle}</small></span></Link>
  <button className="icon-btn mobile-site-toggle" aria-label={mobile?'Close navigation':'Open navigation'} aria-expanded={mobile} onClick={()=>setMobile(!mobile)}>{mobile?<X/>:<Menu/>}</button>
  <div className={'site-links'+(mobile?' opened':'')}>{links.map(([href,label])=><Link key={href} href={href} onClick={()=>setMobile(false)}>{label}</Link>)}<Link href="/my-applications" onClick={()=>setMobile(false)}>My applications</Link><Link className="site-login" href="/login" onClick={()=>setMobile(false)}>Staff login <ArrowRight size={15}/></Link></div>
 </nav></header>
 {children}
 <footer className="site-footer"><div className="container site-footer-inner"><div><Link className="site-identity" href="/"><BrandLogo size={58}/><span><strong>{site.organization}</strong><small>{site.subtitle}</small></span></Link><p>Head · Heart · Hand</p></div><div className="site-footer-nav">{links.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</div></div><div className="container site-copyright"><div className="inline-form"><Link href="/privacy">Privacy notice</Link><Link href="/terms">Application terms</Link></div>© {new Date().getFullYear()} {site.organization} · Official information and applications</div></footer>
 </div>;
}
export function PageIntro({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){
 return <div className="site-page-hero"><div className="container"><span className="overline">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div>;
}
