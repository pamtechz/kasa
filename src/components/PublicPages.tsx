'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,CalendarDays,Pin,BookOpen,Info,CheckSquare,Square,FileCheck,FileText,ShieldCheck,CheckCircle2} from 'lucide-react';
import {defaultSite,type SiteSettings} from '@/lib/site';
import {getCachedSite,fetchSiteCached,fetchContentCached} from '@/lib/client-cache';
import type {Programme,Announcement} from '@/lib/content';
import {PublicApplicationLinks} from '@/components/PublicApplicationLinks';
type Mode='about'|'how'|'contact'|'agents'|'admissions'|'privacy'|'terms';
export function InformationPage({mode}:{mode:Mode}){
 const [site,setSite]=useState<SiteSettings>(getCachedSite()||defaultSite),[intake,setIntake]=useState<{open:boolean;reason?:string;opensAt?:string|null;closesAt?:string|null}|null>(null);
 useEffect(()=>{
  fetchSiteCached().then(s=>{if(s)setSite(s);});
  if(mode==='admissions')fetch('/api/public/intake').then(r=>r.json()).then(setIntake).catch(()=>{});
 },[mode]);
 if(mode==='privacy'||mode==='terms')return <div className="site-article"><h2>{mode==='privacy'?'Applicant privacy notice':'Application terms'}</h2><div className="site-prose">{mode==='privacy'?site.privacyText:site.termsText}</div><p>For clarification, use the official <Link href="/contact" className="text-link">KASA contact page</Link>.</p></div>;
 if(mode==='about')return <><p className="lead-copy">{site.aboutDescription}</p><div className="site-cards">{site.aboutValues.map((x,i)=><article className="site-card" key={i}><h2>{x.title}</h2><p>{x.description}</p></article>)}</div><p>Interested in the programmes? <Link className="text-link" href="/programmes">Explore available courses <ArrowRight size={15}/></Link></p></>;
 if(mode==='how')return <><p className="lead-copy">{site.howDescription}</p><div className="site-cards">{site.steps.map((x,i)=><article className="site-card" key={i}><span className="overline">STEP {i+1}</span><h2>{x.title}</h2><p>{x.description}</p></article>)}</div><p>Acceptance to a programme is separate from government sponsorship approval.</p></>;
 if(mode==='contact')return <div className="site-cards"><article className="site-card"><h2>{site.contactTitle}</h2><p>{site.contactDescription}</p><p>{site.contactEmail?<a href={'mailto:'+site.contactEmail}>{site.contactEmail}</a>:'Email not published yet'}</p><p>{site.contactPhone?<a href={'tel:'+site.contactPhone}>{site.contactPhone}</a>:'Phone contact not published yet'}</p></article></div>;
 if(mode==='agents')return <><p className="lead-copy">{site.ctaDescription}</p><div className="site-cards"><article className="site-card"><h2>Apply and receive approval</h2><p>Prospective district agents apply and KASA reviews each application. Approved agents receive district assignments, authenticated accounts and unique referral codes.</p></article><article className="site-card"><h2>Refer students responsibly</h2><p>Share the official application link. Do not promise CDF approval or collect unofficial CDF application charges.</p></article><article className="site-card"><h2>Verified commissions</h2><p>Commission eligibility follows independently verified student payment or official CDF sponsorship approval supported by required documents.</p></article></div><PublicApplicationLinks placement="catalog"/></>;
 function AdmissionsGuideAndChecklist({intake}:{intake:{open:boolean;reason?:string;opensAt?:string|null;closesAt?:string|null}|null}){
  const [checked,setChecked]=useState<Record<string,boolean>>({
   nrc:true,
   results:true,
   recommendation:false,
   cdf:false,
   photo:false
  });

  const items=[
   {id:'nrc',label:'National Registration Card (NRC) or Guardian ID',desc:'Scanned copy or clear photo (PDF / PNG / JPG)'},
   {id:'results',label:'Grade 12 Certificate or Grade 9 Result Slip',desc:'Certified copy of academic statements'},
   {id:'recommendation',label:'Recommendation / Reference Letter',desc:'Signed by head teacher, civic or church leader'},
   {id:'cdf',label:'Official CDF Application Form (If applying for CDF)',desc:'Completed constituency sponsorship form'},
   {id:'photo',label:'Passport Size Photo',desc:'Clear front-facing portrait photograph'}
  ];

  const readyCount=Object.values(checked).filter(Boolean).length;
  const toggleItem=(id:string)=>setChecked(prev=>({...prev,[id]:!prev[id]}));

  return <div className="admissions-wrapper">
   <div className="site-card intake-status-card">
    <div className="intake-status-head">
     <div className="status-indicator">
      <span className={`status-dot ${intake?.open?'open':'closed'}`}></span>
      <strong>{intake===null?'Checking admissions status…':intake.open?'2027 Admissions Open':'Applications Closed'}</strong>
     </div>
     {intake?.open&&<span className="intake-pill">Accepting CDF & Self-Funded Applicants</span>}
    </div>
    <p>{intake===null?'Loading active intake information…':intake.open?'KASA is currently receiving applications for the upcoming 2027 academic intakes. Select a programme below to apply online.':intake.reason||'Applications are currently closed.'}</p>
    {intake?.opensAt&&<p className="muted">Scheduled opening: {new Date(intake.opensAt).toLocaleString()}</p>}
    {intake?.closesAt&&<p className="muted">Scheduled deadline: {new Date(intake.closesAt).toLocaleString()}</p>}
   </div>

   <div className="section-block">
    <span className="overline">3-STEP APPLICATION FLOW</span>
    <h2>How to apply for KASA admission</h2>
    <div className="site-cards steps-grid">
     <article className="site-card step-card">
      <span className="step-num">01</span>
      <h3>Select Course & Intake</h3>
      <p>Choose your preferred training programme and intake period from the published catalogue.</p>
     </article>
     <article className="site-card step-card">
      <span className="step-num">02</span>
      <h3>Prepare & Upload Files</h3>
      <p>Attach certified copies of your NRC, academic statement, and recommendation letter.</p>
     </article>
     <article className="site-card step-card">
      <span className="step-num">03</span>
      <h3>Track & Confirm Funding</h3>
      <p>KASA evaluates your application. Confirm enrollment via verified self-funded payment or official CDF sponsorship approval.</p>
     </article>
    </div>
   </div>

   <div className="checklist-container panel pad-panel">
    <div className="checklist-head">
     <div>
      <span className="overline">APPLICANT CHECKLIST</span>
      <h2>Document Readiness Checker</h2>
      <p>Check off the documents you have prepared before starting your online application.</p>
     </div>
     <div className="readiness-meter">
      <strong>{readyCount} of {items.length}</strong>
      <span>Documents Ready</span>
     </div>
    </div>

    <div className="checklist-items">
     {items.map(item=><div key={item.id} className={`checklist-item ${checked[item.id]?'is-checked':''}`} onClick={()=>toggleItem(item.id)}>
      <button type="button" className="check-btn" aria-label={checked[item.id]?'Uncheck document':'Check document'}>
       {checked[item.id]?<CheckSquare size={20} className="icon-checked"/>:<Square size={20} className="icon-unchecked"/>}
      </button>
      <div>
       <strong>{item.label}</strong>
       <p>{item.desc}</p>
      </div>
     </div>)}
    </div>
   </div>

   <div id="cdf" className="site-card cdf-guidance-card">
    <div className="cdf-head">
     <ShieldCheck size={28} className="cdf-icon"/>
     <div>
      <h2>Constituency Development Fund (CDF) Sponsorship</h2>
      <p>CDF is an official government sponsorship method administered by local district authorities.</p>
     </div>
    </div>
    <div className="cdf-points">
     <div>
      <strong>Free Forms & Transparency</strong>
      <p>Official KASA application forms and CDF application guidelines are completely free. No agent is permitted to charge fees for forms or promise guaranteed government approval.</p>
     </div>
     <div>
      <strong>Verification & Acceptance</strong>
      <p>Applicants receiving CDF sponsorship must provide official approval letters issued by their local CDF committee before enrollment is confirmed.</p>
     </div>
    </div>
    <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid #cbe2d3',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
     <span style={{fontSize:13,color:'var(--green)',fontWeight:600}}>Need a physical copy for manual submission or CDF application?</span>
     <a href="/api/public/download-enrollment-form" target="_blank" rel="noopener noreferrer" className="btn btn-primary-sm" style={{textDecoration:'none'}}>
      <BookOpen size={14}/> Download Blank Enrollment Form (PDF)
     </a>
    </div>
   </div>

   <PublicApplicationLinks placement="catalog"/>
  </div>;
 }

 return <AdmissionsGuideAndChecklist intake={intake}/>;
}
export function CollectionView({kind}:{kind:'programmes'|'announcements'}){
 const [items,setItems]=useState<(Programme|Announcement)[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [category,setCategory]=useState<string>('all');
 const [search,setSearch]=useState<string>('');

 useEffect(()=>{fetchContentCached(kind).then(setItems).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[kind]);

 if(loading)return <p className="muted">Loading {kind}…</p>;
 if(error)return <div className="notice">{error}. Please check again later.</div>;
 if(!items.length)return <div className="site-card"><Info size={20}/><p>No published {kind} yet. KASA will publish verified information here.</p></div>;

 if(kind==='programmes'){
  const programmes=items as Programme[];
  const categories=[
   {id:'all',label:'All Programmes'},
   {id:'main',label:'Main Programmes'},
   {id:'agri-sport',label:'Agri-Sport'},
   {id:'short-course',label:'Short Courses'}
  ];
  const filtered=programmes.filter(p=>{
   const matchesCat=category==='all'||p.category===category;
   const q=search.toLowerCase().trim();
   const matchesSearch=!q||p.title.toLowerCase().includes(q)||p.description.toLowerCase().includes(q)||(p.requirements&&p.requirements.toLowerCase().includes(q));
   return matchesCat&&matchesSearch;
  });

  return <div className="catalog-wrapper">
   <div className="catalog-controls">
    <div className="filter-pills">
     {categories.map(c=><button key={c.id} type="button" className={`pill-btn ${category===c.id?'active':''}`} onClick={()=>setCategory(c.id)}>{c.label}</button>)}
    </div>
    <div className="search-box">
     <input type="text" placeholder="Search programmes or skills..." value={search} onChange={e=>setSearch(e.target.value)}/>
    </div>
   </div>

   {filtered.length===0?<div className="site-card"><Info size={20}/><p>No programmes match your current filter criteria.</p></div>:
   <div className="site-cards programmes-grid">{filtered.map(p=><article className="site-card programme-card" key={p.id}>
    <div className="card-badge-row">
     <span className="overline tag-green">{p.category.replaceAll('-',' ')}</span>
     <span className="duration-tag"><CalendarDays size={12}/> {p.duration}</span>
    </div>
    <h2>{p.title}</h2>
    <p>{p.description}</p>
    {p.modules&&p.modules.length>0&&<div className="module-tags">{p.modules.slice(0,3).map((m,i)=><span key={i} className="module-tag">{m}</span>)}{p.modules.length>3&&<span className="module-tag muted">+{p.modules.length-3} more</span>}</div>}
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
   </article>)}</div>}
  </div>;
 }

 if(kind==='announcements'){
  const announcements=items as Announcement[];
  const categories=[
   {id:'all',label:'All Updates'},
   {id:'admissions',label:'Admissions'},
   {id:'cdf',label:'CDF Sponsorship'},
   {id:'academic',label:'Academic'},
   {id:'agents',label:'District Agents'},
   {id:'general',label:'General'}
  ];

  const filtered=announcements.filter(a=>{
   const matchesCat=category==='all'||a.category===category;
   const q=search.toLowerCase().trim();
   const matchesSearch=!q||a.title.toLowerCase().includes(q)||a.description.toLowerCase().includes(q)||(a.body&&a.body.toLowerCase().includes(q));
   return matchesCat&&matchesSearch;
  });

  const pinnedItem=filtered.find(a=>a.pinned);
  const unpinnedItems=pinnedItem?filtered.filter(a=>a.id!==pinnedItem.id):filtered;

  return <div className="newsroom-wrapper">
   <div className="catalog-controls">
    <div className="filter-pills">
     {categories.map(c=><button key={c.id} type="button" className={`pill-btn ${category===c.id?'active':''}`} onClick={()=>setCategory(c.id)}>{c.label}</button>)}
    </div>
    <div className="search-box">
     <input type="text" placeholder="Search announcements..." value={search} onChange={e=>setSearch(e.target.value)}/>
    </div>
   </div>

   {pinnedItem&&<div className="site-card pinned-notice-card">
    <div className="pinned-head">
     <span className="overline pinned-badge"><Pin size={13} aria-hidden="true"/> FEATURED NOTICE</span>
     <span className="overline tag-green">{pinnedItem.category}</span>
    </div>
    <h2>{pinnedItem.title}</h2>
    <p>{pinnedItem.description}</p>
    <div className="pinned-footer">
     {pinnedItem.publishedAt&&<span className="muted"><CalendarDays size={12}/> {new Date(pinnedItem.publishedAt).toLocaleDateString('en-ZM',{dateStyle:'medium'})}</span>}
     <Link href={'/announcements/'+pinnedItem.id} className="btn btn-primary-sm">Read full update <ArrowRight size={13}/></Link>
    </div>
   </div>}

   {unpinnedItems.length===0&&!pinnedItem?<div className="site-card"><Info size={20}/><p>No announcements match your search query or selected category.</p></div>:
   <div className="site-cards news-grid">{unpinnedItems.map(a=><article className="site-card news-card" key={a.id}>
    <div className="card-badge-row">
     <span className="overline tag-green">{a.category}</span>
     {a.publishedAt&&<span className="muted font-xs"><CalendarDays size={11}/> {new Date(a.publishedAt).toLocaleDateString('en-ZM',{month:'short',day:'numeric'})}</span>}
    </div>
    <h2>{a.title}</h2>
    <p>{a.description}</p>
    <div className="card-footer-row">
     <Link href={'/announcements/'+a.id} className="text-link">Read update <ArrowRight size={14}/></Link>
    </div>
   </article>)}</div>}
  </div>;
 }

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
 useEffect(()=>{fetchContentCached('programmes').then(items=>setItems(items as Programme[])).catch(e=>setError(e.message));},[]);
 return <>{error&&<p className="alert-error">{error}</p>}<div className="panel table-scroll"><table className="data-table"><thead><tr><th>Course / programme</th><th>Duration</th><th>Tuition</th><th>Full proposed package*</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td><Link href={'/programmes/'+x.id}>{x.title}</Link></td><td>{x.duration}</td><td>{x.fee.tuition===null?'To be confirmed':'K'+x.fee.tuition.toLocaleString('en-ZM')}</td><td>{x.fee.packageTotal===null?'To be confirmed':'K'+x.fee.packageTotal.toLocaleString('en-ZM')}</td></tr>)}{!items.length&&<tr><td colSpan={4}>No published fees at present.</td></tr>}</tbody></table></div><p className="muted">*Packages may include optional food and accommodation. The quoted proposals are subject to confirmation by KASA. Check the course page for components and external qualification status.</p></>;
}
