'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Search,BookOpen,CheckCircle2,FileText} from 'lucide-react';
import {SiteChrome} from './SiteChrome';
import {fetchContentCached} from '@/lib/client-cache';
import type {Programme} from '@/lib/content';
type Form={slug:string;title:string;kind:string;open:boolean;reason?:string};
export function AdmissionsPage(){
 const [forms,setForms]=useState<Form[]>([]),[programmes,setProgrammes]=useState<Programme[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState('');
 const [programmeError,setProgrammeError]=useState('');
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let live=true;setLoading(true);setError('');
  fetch('/api/public/forms',{cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to load applications.');if(live)setForms(data.forms||[]);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});
  fetchContentCached('programmes').then(items=>{if(!live)return;setProgrammes(items as Programme[]);const selected=new URLSearchParams(location.search).get('programme');const match=items.find(p=>p.id===selected||p.title===selected);if(match)setQuery(match.title);}).catch(()=>{if(live)setProgrammeError('Programme details are temporarily unavailable. You can still open an available application.');});
  return ()=>{live=false;};
 },[retry]);
 const open=forms.filter(f=>f.kind==='student'&&f.open),student=open[0];
 const visible=programmes.filter(p=>(p.title+' '+p.description).toLowerCase().includes(query.toLowerCase()));
 const apply=(p?:Programme)=>student?'/apply/'+student.slug+(p?'?programme='+encodeURIComponent(p.title):''):'#apply';
 return <SiteChrome>
  <main id="main-content">
   <section className="admissions-hero"><div className="container admissions-hero-grid">
    <div><span className="overline">KASA ADMISSIONS</span><h1>Your next step starts here.</h1><p>Choose your programme, fill in your details and send your application. You can apply online without creating a KASA account.</p>
     <div className="actions"><Link className="btn btn-primary" href={apply()}>Apply now <ArrowRight size={18}/></Link><a href="#programmes" className="text-link">Explore programmes</a></div>
     <p className="admissions-note"><CheckCircle2 size={16}/> Application forms are free. CDF and self-funded applicants are welcome.</p>
    </div>
    <ol className="admissions-steps"><li><span>1</span><div><strong>Choose a programme</strong><p>Check the entry requirements.</p></div></li><li><span>2</span><div><strong>Complete your details</strong><p>Follow the short sections. Your progress stays in this tab.</p></div></li><li><span>3</span><div><strong>Review and submit</strong><p>Keep your reference to follow up.</p></div></li></ol>
   </div></section>
   <div className="container admissions-body">
    <section id="apply" className="admissions-apply" aria-labelledby="apply-title"><div><span className="overline">START YOUR APPLICATION</span><h2 id="apply-title">Ready to apply?</h2><p>Have your contact details and programme choice ready. The form will tell you which documents are needed.</p></div>
     <div className="admissions-apply-actions" aria-live="polite">{loading?<p role="status">Checking available applications…</p>:error?<div role="alert"><p>{error}</p><button type="button" className="btn btn-outline" onClick={()=>setRetry(x=>x+1)}>Try again</button> <Link href="/contact">Contact admissions</Link></div>:open.length?open.map(f=><Link key={f.slug} href={'/apply/'+f.slug} className="btn btn-primary">{open.length===1?'Start application':f.title}<ArrowRight size={17}/></Link>):<div><strong>Applications are currently closed</strong><p>{forms.find(f=>f.kind==='student')?.reason||'Please contact admissions for the next opening.'}</p><Link href="/contact" className="text-link">Contact admissions</Link></div>}</div>
    </section>
    <section id="programmes" aria-labelledby="programmes-title"><div className="admissions-programmes-head"><div><span className="overline">FIND YOUR COURSE</span><h2 id="programmes-title">Choose your programme</h2></div><label className="admissions-search"><Search size={18}/><input type="search" aria-label="Search programmes" placeholder="Search programmes" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
     {programmeError&&<p role="status">{programmeError}</p>}
     <div className="admissions-programmes">{visible.map(p=><article className="admissions-programme" key={p.id}><BookOpen size={23}/><h3>{p.title}</h3>{p.duration&&<p className="muted">{p.duration}</p>}<p>{p.description}</p><details><summary>Entry requirements</summary><p>{p.requirements||'Contact admissions for programme requirements.'}</p></details><div className="actions">{student?<Link href={apply(p)} className="btn btn-primary">Apply for this programme <ArrowRight size={16}/></Link>:<a href="#apply" className="text-link">Check application availability</a>}<Link href={'/programmes/'+p.id} className="text-link">Course details</Link></div></article>)}</div>
     {!loading&&!programmeError&&!visible.length&&<p role="status">{query?'No programmes match your search. Try another word.':'Programmes will appear when published by KASA.'}</p>}
    </section>
    <section className="admissions-help" aria-label="Application guidance"><details><summary>What documents will I need?</summary><p>Requirements depend on the programme. Prepare a clear photo or PDF of the documents requested in the application. If an upload is needed, authorize your own Cloudflare storage. Files go directly there; submitting shares only those attachments with KASA.</p></details><details id="cdf"><summary>How does CDF sponsorship work?</summary><p>Apply to KASA for admission, then follow your constituency’s official CDF process. Admission does not guarantee government sponsorship. KASA confirms funding after the relevant approval and payment checks.</p></details><details><summary>Need help completing your application?</summary><p><Link href="/contact">Contact KASA admissions</Link> or <Link href="/my-applications">check an existing application</Link>.</p></details><a href="/api/public/download-enrollment-form" className="text-link"><FileText size={16}/> Download the blank form</a></section>
   </div>
  </main>
 </SiteChrome>;
}
