'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,CalendarDays,BookOpen,Info} from 'lucide-react';
import {defaultSite,type SiteSettings} from '@/lib/site';
import type {Programme,Announcement} from '@/lib/content';
import {PublicApplicationLinks} from '@/components/PublicApplicationLinks';
type Mode='about'|'how'|'contact'|'agents'|'admissions';
export function InformationPage({mode}:{mode:Mode}){
 const [site,setSite]=useState<SiteSettings>(defaultSite),[intake,setIntake]=useState<{open:boolean;reason?:string;opensAt?:string|null;closesAt?:string|null}|null>(null);
 useEffect(()=>{
  fetch('/api/public/site').then(r=>r.json()).then(r=>{if(r?.site)setSite(r.site)}).catch(()=>{});
  if(mode==='admissions')fetch('/api/public/intake').then(r=>r.json()).then(setIntake).catch(()=>{});
 },[mode]);
 if(mode==='about')return <><p className="lead-copy">{site.aboutDescription}</p><div className="site-cards">{site.aboutValues.map((x,i)=><article className="site-card" key={i}><h2>{x.title}</h2><p>{x.description}</p></article>)}</div><p>Interested in the programmes? <Link className="text-link" href="/programmes">Explore available courses <ArrowRight size={15}/></Link></p></>;
 if(mode==='how')return <><p className="lead-copy">{site.howDescription}</p><div className="site-cards">{site.steps.map((x,i)=><article className="site-card" key={i}><span className="overline">STEP {i+1}</span><h2>{x.title}</h2><p>{x.description}</p></article>)}</div><p>Acceptance to a programme is separate from government sponsorship approval.</p></>;
 if(mode==='contact')return <div className="site-cards"><article className="site-card"><h2>{site.contactTitle}</h2><p>{site.contactDescription}</p><p>{site.contactEmail?<a href={'mailto:'+site.contactEmail}>{site.contactEmail}</a>:'Email not published yet'}</p><p>{site.contactPhone?<a href={'tel:'+site.contactPhone}>{site.contactPhone}</a>:'Phone contact not published yet'}</p></article></div>;
 if(mode==='agents')return <><p className="lead-copy">{site.ctaDescription}</p><div className="site-cards"><article className="site-card"><h2>Apply and receive approval</h2><p>Prospective district agents apply and KASA reviews each application. Approved agents receive district assignments, authenticated accounts and unique referral codes.</p></article><article className="site-card"><h2>Refer students responsibly</h2><p>Share the official application link. Do not promise CDF approval or collect unofficial CDF application charges.</p></article><article className="site-card"><h2>Verified commissions</h2><p>Commission eligibility follows independently verified student payment or official CDF sponsorship approval supported by required documents.</p></article></div><PublicApplicationLinks placement="catalog"/></>;
 return <><div className="site-card"><h2>Application status</h2><p>{intake===null?'Checking admissions…':intake.open?'KASA admissions are currently open.':intake.reason||'Applications are closed.'}</p>{intake?.opensAt&&<p>Scheduled opening: {new Date(intake.opensAt).toLocaleString()}</p>}{intake?.closesAt&&<p>Scheduled closing: {new Date(intake.closesAt).toLocaleString()}</p>}</div><div className="site-cards"><article className="site-card"><h2>Applying for admission</h2><p>Select a published form, choose an intake and course, upload the required documents, then keep your application reference.</p></article><article className="site-card"><h2>CDF-sponsored students</h2><p>CDF is a government sponsorship method. KASA checks the required documents and independently verifies the official approval before treating an enrollment as CDF-sponsored.</p></article><article className="site-card"><h2>Self-funded students</h2><p>KASA records verified enrollment payments against the student application; submission of the application is not itself payment.</p></article></div><PublicApplicationLinks placement="catalog"/></>;
}
export function CollectionView({kind}:{kind:'programmes'|'announcements'}){
 const [items,setItems]=useState<(Programme|Announcement)[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/public/content?kind='+kind,{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load content');setItems(d.items||[])}).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[kind]);
 if(loading)return <p className="muted">Loading {kind}…</p>;
 if(error)return <div className="notice">{error}. Please check again later.</div>;
 if(!items.length)return <div className="site-card"><Info size={20}/><p>No published {kind} yet. KASA will publish verified information here.</p></div>;
 return <div className="site-cards">{items.map(x=><article className="site-card" key={x.id}>
 <span className="overline">{kind==='programmes'?(x as Programme).category.replaceAll('-',' '):(x as Announcement).category}</span>
 <h2>{x.title}</h2><p>{x.description}</p>
 {kind==='programmes'&&<p className="muted">{(x as Programme).duration}</p>}
 <Link href={'/'+kind+'/'+x.id} className="text-link">Read more <ArrowRight size={15}/></Link>
 </article>)}</div>;
}
export function PublicDetail({kind,id}:{kind:'programmes'|'announcements';id:string}){
 const [item,setItem]=useState<Programme|Announcement|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{fetch('/api/public/content/'+kind+'/'+encodeURIComponent(id),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Not found');setItem(d.item)}).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[kind,id]);
 if(loading)return <p className="muted">Loading details…</p>;
 if(error||!item)return <p>{error||'This item is no longer published.'}</p>;
 if(kind==='announcements'){const x=item as Announcement;return <article className="site-article"><span className="overline">{x.category}</span><h2>{x.title}</h2><p>{x.description}</p><div className="site-prose">{x.body}</div><Link href="/announcements" className="text-link">Back to announcements</Link></article>}
 const x=item as Programme;return <article className="site-article"><h2>{x.title}</h2><p className="lead-copy">{x.description}</p><p><strong>Duration:</strong> {x.duration}</p><h3>Entry requirements</h3><p>{x.requirements||'Contact KASA for requirements.'}</p><h3>Learning areas</h3><ul>{x.modules.map((m,i)=><li key={i}>{m}</li>)}</ul><h3>Certification and programme status</h3><p>{x.certification}</p><p><strong>Fee information:</strong> {x.fee.tuition!==null?'K'+x.fee.tuition.toLocaleString('en-ZM')+' tuition':'Fees not yet published'}. {x.fee.note}</p><Link href="/admissions" className="btn btn-primary">Check admissions <ArrowRight size={16}/></Link></article>;
}
export function FeesView(){
 const [items,setItems]=useState<Programme[]>([]),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/public/content?kind=programmes').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Fee information unavailable');setItems(d.items||[])}).catch(e=>setError(e.message));},[]);
 return <>{error&&<p className="alert-error">{error}</p>}<div className="panel table-scroll"><table className="data-table"><thead><tr><th>Course / programme</th><th>Duration</th><th>Tuition</th><th>Full proposed package*</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td><Link href={'/programmes/'+x.id}>{x.title}</Link></td><td>{x.duration}</td><td>{x.fee.tuition===null?'To be confirmed':'K'+x.fee.tuition.toLocaleString('en-ZM')}</td><td>{x.fee.packageTotal===null?'To be confirmed':'K'+x.fee.packageTotal.toLocaleString('en-ZM')}</td></tr>)}{!items.length&&<tr><td colSpan={4}>No published fees at present.</td></tr>}</tbody></table></div><p className="muted">*Packages may include optional food and accommodation. The quoted proposals are subject to confirmation by KASA. Check the course page for components and external qualification status.</p></>;
}
