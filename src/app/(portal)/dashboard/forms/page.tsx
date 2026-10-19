'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Copy,FilePlus2,Plus,Trash2} from 'lucide-react';
import {api,cachedApi,PageHeader} from '@/components/Portal';
import type {FormSchema} from '@/lib/types';
export default function Forms(){
 const [forms,setForms]=useState<FormSchema[]>([]),[name,setName]=useState(''),[creating,setCreating]=useState(false),[error,setError]=useState(''),[importText,setImportText]=useState(''),[loading,setLoading]=useState(true);
 const load=(force=false)=>{
  if(force){
   return api<{forms:FormSchema[]}>('/api/admin/forms').then(r=>setForms(r.forms)).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  }
  return cachedApi<{forms:FormSchema[]}>('/api/admin/forms',fresh=>setForms(fresh.forms)).then(r=>setForms(r.forms)).catch(e=>setError(e.message)).finally(()=>setLoading(false));
 };
 useEffect(()=>{void load()},[]);
 async function create(){setError('');if(!name.trim())return;setCreating(true);try{
 const slug=name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-');
 const data={slug,title:name,subtitle:'Complete all required fields to submit your application.',kind:'custom',published:false,sections:[{id:'section-1',title:'Applicant details',fields:[{id:'full-name',label:'Full name',type:'text',required:true}]}]};
 await api('/api/admin/forms',{method:'POST',body:JSON.stringify(data)});setName('');await load(true);
 }catch(e){setError(e instanceof Error?e.message:'Unable to create form.');}finally{setCreating(false);}}
 async function importTemplate(){setError('');try{const json=JSON.parse(importText);await api('/api/admin/forms/import',{method:'POST',body:JSON.stringify(json)});setImportText('');await load(true);}catch(e){setError(e instanceof Error?e.message:'Import failed.');}}
 async function deleteForm(id:string,title:string){
  if(!window.confirm(`Are you sure you want to permanently delete form "${title}"? This cannot be undone.`))return;
  setError('');try{await api(`/api/admin/forms/${id}`,{method:'DELETE'});await load(true);}catch(e){setError(e instanceof Error?e.message:'Unable to delete form.');}
 }
 return <><PageHeader title="Form builder" subtitle="Create, customize, version and publish application forms without code."/><div className="panel pad-panel"><h2>Create a form</h2><div className="inline-form"><input placeholder="E.g. Student enrollment — January intake" value={name} onChange={e=>setName(e.target.value)}/><button className="btn btn-primary" disabled={creating} onClick={()=>void create()}><Plus size={17}/> New form</button></div>{error&&<p className="error-text">{error}</p>}</div><div className="panel pad-panel"><h2>Import an existing form template</h2><p className="muted">Paste a JSON template exported from your existing Google Form using the supplied Apps Script exporter. Imported forms remain drafts until reviewed and published.</p><div className="field"><label>Form template JSON</label><textarea rows={4} placeholder="Paste JSON template…" value={importText} onChange={e=>setImportText(e.target.value)}/></div><button className="btn btn-outline" onClick={()=>void importTemplate()} disabled={!importText.trim()}>Import template</button></div><div className="cards-list">{loading?Array.from({length:3}).map((_,i)=><div className="form-list-card" key={'skel-form-'+i}><div className="skeleton-row" style={{width:'100%',height:55}}/></div>):forms.length>0?forms.map(f=><div className="form-list-card" key={f.id}><div className="form-icon"><FilePlus2 size={22}/></div><div><div className="form-list-title">{f.title} <span className={'tag '+(f.published?'tag-green':'tag-gray')}>{f.published?'Published':'Draft'}</span></div><p>/{f.slug} · {f.sections.length} sections · Version {f.version}</p></div><div style={{display:'flex',gap:8,alignItems:'center',marginLeft:'auto'}}><Link className="btn btn-outline" href={`/dashboard/forms/${f.id}`}>Edit form <ArrowRight size={16}/></Link><button className="icon-btn" style={{color:'#ef4444'}} title="Delete form" onClick={()=>void deleteForm(f.id,f.title)} aria-label="Delete form"><Trash2 size={17}/></button></div></div>):<div className="empty-panel">No forms yet. Create your first form or run the starter-template seed script.</div>}</div></>;
}
