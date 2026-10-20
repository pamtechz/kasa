'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Copy,FilePlus2,Plus,Trash2} from 'lucide-react';
import {api,cachedApi,PageHeader} from '@/components/Portal';
import {ConfirmModal} from '@/components/ConfirmModal';
import type {FormSchema} from '@/lib/types';
export default function Forms(){
 const [forms,setForms]=useState<FormSchema[]>([]),[name,setName]=useState(''),[creating,setCreating]=useState(false),[error,setError]=useState(''),[importText,setImportText]=useState(''),[loading,setLoading]=useState(true);
 const [deletingForm,setDeletingForm]=useState<{id:string;title:string}|null>(null);
 const [selectedFormIds,setSelectedFormIds]=useState<Set<string>>(new Set());
 const [bulkDeleteTarget,setBulkDeleteTarget]=useState<'selected'|'all'|null>(null);
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
 async function confirmDeleteForm(){
  if(!deletingForm)return;
  setError('');
  try{
   await api(`/api/admin/forms/${deletingForm.id}`,{method:'DELETE'});
   setDeletingForm(null);
   await load(true);
  }catch(e){setError(e instanceof Error?e.message:'Unable to delete form.');}
 }

 async function confirmBulkDeleteForms(){
  if(!bulkDeleteTarget)return;
  setError('');
  try{
   const idsToDelete = bulkDeleteTarget === 'selected' ? Array.from(selectedFormIds) : forms.map(f => f.id);
   for (const id of idsToDelete) {
    await api(`/api/admin/forms/${id}`,{method:'DELETE'});
   }
   setSelectedFormIds(new Set());
   setBulkDeleteTarget(null);
   await load(true);
  }catch(e){setError(e instanceof Error?e.message:'Bulk delete failed.');}
 }

 function toggleSelectForm(id: string) {
  const next = new Set(selectedFormIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  setSelectedFormIds(next);
 }
 return <><PageHeader title="Form builder" subtitle="Create, customize, version and publish application forms without code."/><div className="panel pad-panel"><h2>Create a form</h2><div className="inline-form"><input placeholder="E.g. Student enrollment — January intake" value={name} onChange={e=>setName(e.target.value)}/><button className="btn btn-primary" disabled={creating} onClick={()=>void create()}><Plus size={17}/> New form</button></div>{error&&<p className="error-text">{error}</p>}</div><div className="panel pad-panel"><h2>Import an existing form template</h2><p className="muted">Paste a JSON template exported from your existing Google Form using the supplied Apps Script exporter. Imported forms remain drafts until reviewed and published.</p><div className="field"><label>Form template JSON</label><textarea rows={4} placeholder="Paste JSON template…" value={importText} onChange={e=>setImportText(e.target.value)}/></div><button className="btn btn-outline" onClick={()=>void importTemplate()} disabled={!importText.trim()}>Import template</button></div><div className="panel pad-panel"><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:12}}><h2>Published and draft forms</h2>{forms.length > 0 && <div style={{display:'flex',gap:8}}>{selectedFormIds.size > 0 && <button className="btn btn-outline" onClick={() => setBulkDeleteTarget('selected')} style={{fontSize:12,padding:'6px 12px',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',display:'inline-flex',alignItems:'center',gap:6}}><Trash2 size={14}/> Delete Selected ({selectedFormIds.size})</button>}<button className="btn btn-outline" onClick={() => setBulkDeleteTarget('all')} style={{fontSize:12,padding:'6px 12px',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',display:'inline-flex',alignItems:'center',gap:6}}><Trash2 size={14}/> Delete All Forms ({forms.length})</button></div>}</div><div className="cards-list">{loading?Array.from({length:3}).map((_,i)=><div className="form-list-card" key={'skel-form-'+i}><div className="skeleton-row" style={{width:'100%',height:55}}/></div>):forms.length>0?forms.map(f=><div className="form-list-card" key={f.id}><input type="checkbox" checked={selectedFormIds.has(f.id)} onChange={() => toggleSelectForm(f.id)} aria-label={`Select ${f.title}`} style={{marginRight:8}}/><div className="form-icon"><FilePlus2 size={22}/></div><div><div className="form-list-title">{f.title} <span className={'tag '+(f.published?'tag-green':'tag-gray')}>{f.published?'Published':'Draft'}</span></div><p>/{f.slug} · {f.sections.length} sections · Version {f.version}</p></div><div style={{display:'flex',gap:8,alignItems:'center',marginLeft:'auto'}}><Link className="btn btn-outline" href={`/dashboard/forms/${f.id}`}>Edit form <ArrowRight size={16}/></Link><button className="icon-btn" style={{color:'#ef4444'}} title="Delete form" onClick={()=>setDeletingForm({id:f.id,title:f.title})} aria-label="Delete form"><Trash2 size={17}/></button></div></div>):<div className="empty-panel">No forms yet. Create your first form or run the starter-template seed script.</div>}</div></div>
 <ConfirmModal
  isOpen={Boolean(deletingForm)}
  title="Delete Application Form"
  message={`Are you sure you want to permanently delete form "${deletingForm?.title}"? This cannot be undone.`}
  kind="danger"
  confirmLabel="Delete Form"
  cancelLabel="Cancel"
  onConfirm={()=>void confirmDeleteForm()}
  onCancel={()=>setDeletingForm(null)}
 />

 <ConfirmModal
  isOpen={Boolean(bulkDeleteTarget)}
  title="Delete Multiple Application Forms"
  message={`Are you sure you want to permanently delete ${bulkDeleteTarget === 'selected' ? `${selectedFormIds.size} selected` : `all ${forms.length}`} application form(s)? This action cannot be undone.`}
  kind="danger"
  confirmLabel="Delete Forms"
  cancelLabel="Cancel"
  onConfirm={()=>void confirmBulkDeleteForms()}
  onCancel={()=>setBulkDeleteTarget(null)}
 />
</>;
}
