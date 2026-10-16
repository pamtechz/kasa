'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,ClipboardList} from 'lucide-react';

type PublicForm={slug:string;title:string;subtitle:string;kind:'agent'|'student'|'custom';open:boolean;reason?:string};
type Placement='nav'|'hero'|'cta'|'catalog';
let sharedRequest:Promise<PublicForm[]>|null=null;
let lastFetched=0;
const CACHE_MAX_AGE=30_000;
function loadPublishedForms(){
 // Share concurrent lookups without pinning stale admission state for the entire session.
 if(!sharedRequest||Date.now()-lastFetched>CACHE_MAX_AGE){
  sharedRequest=fetch('/api/public/forms',{cache:'no-store'}).then(async response=>{
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Applications are currently unavailable.');
  return (Array.isArray(data.forms)?data.forms:[]) as PublicForm[];
 }).then(forms=>{lastFetched=Date.now();return forms;})
  .catch(error=>{sharedRequest=null;lastFetched=0;throw error;});
 }
 return sharedRequest;
}
export function PublicApplicationLinks({placement}:{placement:Placement}){
 const [forms,setForms]=useState<PublicForm[]>([]);
 const [status,setStatus]=useState<'loading'|'open'|'unavailable'>('loading');
 useEffect(()=>{
  let active=true;
  const refresh=()=>{
   void loadPublishedForms().then(value=>{
    if(active){setForms(value.filter(f=>f.open));setStatus('open');}
   }).catch(()=>{if(active){setStatus('unavailable');setForms([]);}});
  };
  refresh();
  // After an administrator changes intake status, keep public CTAs in sync.
  const timer=window.setInterval(refresh,60_000);
  window.addEventListener('focus',refresh);
  return ()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[]);
 const agent=forms.find(f=>f.kind==='agent');
 const student=forms.find(f=>f.kind==='student');
 if(placement==='nav')return agent?<Link className="nav-primary" href={'/apply/'+agent.slug}>Become an agent <ArrowRight size={15}/></Link>:<span className="nav-primary" aria-disabled="true">Agent applications closed</span>;
 if(placement==='hero')return <>
  <div className="actions">
   {agent?<Link className="btn btn-light" href={'/apply/'+agent.slug}>Apply to be an agent <ArrowRight size={18}/></Link>:<span className="btn btn-light" aria-disabled="true">Agent application not open</span>}
   {student?<Link className="btn btn-outline-light" href={'/apply/'+student.slug}>Apply for training</Link>:<span className="btn btn-outline-light" aria-disabled="true">Student enrollment not open</span>}
  </div>
  <p className="form-availability-note" role="status">{status==='loading'?'Checking published application forms…':status==='unavailable'?'Applications are temporarily unavailable while KASA completes secure system setup.':forms.length===0?'No application forms are published yet.':forms.length+' application form(s) currently open.'}</p>
 </>;
 if(placement==='cta')return agent?<Link href={'/apply/'+agent.slug} className="btn btn-light">Apply now <ArrowRight size={17}/></Link>:<span className="btn btn-light" aria-disabled="true">Recruitment opening soon</span>;
 if(status!=='open'||forms.length===0)return null;
 return <section className="container section-pad">
  <div className="section-heading"><span className="overline">CURRENT OPPORTUNITIES</span><h2>Published KASA application forms</h2><p>Select the correct application to proceed securely.</p></div>
  <div className="three-cols">{forms.map(f=><article className="feature" key={f.slug}>
    <span><ClipboardList size={24}/></span><h3>{f.title}</h3><p>{f.subtitle}</p>
    <Link className="text-link" href={'/apply/'+f.slug}>Open application <ArrowRight size={16}/></Link>
  </article>)}</div>
 </section>;
}
