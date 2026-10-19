'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import {ArrowDown,ArrowUp,Copy,Eye,Plus,Save,Trash2} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {ConfirmModal} from '@/components/ConfirmModal';
import type {Field,FieldType,FormSchema,Section} from '@/lib/types';
const types:FieldType[]=['text','textarea','email','tel','number','date','select','radio','checkbox','file','image'];
function id(){return crypto.randomUUID().slice(0,8)}
export default function EditForm(){
 const {id:formId}=useParams<{id:string}>();const [form,setForm]=useState<FormSchema|null>(null),[err,setErr]=useState(''),[saved,setSaved]=useState(''),[busy,setBusy]=useState(false),[confirmDelete,setConfirmDelete]=useState(false);
 useEffect(()=>{api<{form:FormSchema}>(`/api/admin/forms/${formId}`).then(x=>setForm(x.form)).catch(e=>setErr(e.message));},[formId]);
 function change(fn:(f:FormSchema)=>FormSchema){setForm(f=>f?fn(structuredClone(f)):null);setSaved('');}
 function sectionChange(si:number,k:keyof Section,v:unknown){change(f=>{(f.sections[si] as unknown as Record<string,unknown>)[k]=v;return f;});}
 function fieldChange(si:number,fi:number,k:keyof Field,v:unknown){change(f=>{(f.sections[si].fields[fi] as unknown as Record<string,unknown>)[k]=v;return f;});}
 function sectionMove(i:number,delta:number){change(f=>{const j=i+delta;if(j<0||j>=f.sections.length)return f;[f.sections[j],f.sections[i]]=[f.sections[i],f.sections[j]];return f;});}
 function fieldMove(si:number,fi:number,delta:number){change(f=>{const list=f.sections[si].fields;const j=fi+delta;if(j<0||j>=list.length)return f;[list[j],list[fi]]=[list[fi],list[j]];return f;});}
 async function save(){if(!form)return;setBusy(true);setErr('');setSaved('');try{
  const {title,subtitle,slug,kind,published,sections}=form;
  const out=await api<{version:number}>(`/api/admin/forms/${formId}`,{method:'PUT',body:JSON.stringify({title,subtitle,slug,kind,published,sections})});
  setForm({...form,version:out.version});setSaved('Saved successfully. Public forms now use the latest published version.');
 }catch(e){setErr(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}}

 async function deleteThisForm(){
  setBusy(true); setErr('');
  try{
   await api(`/api/admin/forms/${formId}`,{method:'DELETE'});
   window.location.href='/dashboard/forms';
  }catch(e){setErr(e instanceof Error?e.message:'Unable to delete form.');setBusy(false);}
 }

 if(!form)return <div className="panel pad-panel">{err||'Loading editor…'}</div>;
 const all=form.sections.flatMap(s=>s.fields);
 return <><PageHeader title="Edit application form" subtitle="Changes are saved to Firestore. Previously submitted application snapshots remain unchanged." action={<div className="action-group">{form.published&&<a className="btn btn-outline" target="_blank" rel="noreferrer" href={`/apply/${form.slug}`}><Eye size={15}/> Preview</a>}<button className="btn btn-primary" disabled={busy} onClick={()=>void save()}><Save size={16}/> {busy?'Saving…':'Save changes'}</button><button className="btn btn-outline" style={{color:'#ef4444',borderColor:'rgba(239,68,68,0.3)'}} disabled={busy} onClick={()=>setConfirmDelete(true)} title="Delete form"><Trash2 size={16}/> Delete form</button></div>}/>
 <div className="editor-grid"><div><div className="panel pad-panel editor-general"><h2>Form settings</h2><div className="form-grid"><div className="field"><label>Title</label><input value={form.title} onChange={e=>change(f=>({...f,title:e.target.value}))}/></div><div className="field"><label>URL slug</label><input value={form.slug} onChange={e=>change(f=>({...f,slug:e.target.value}))}/></div><div className="field full"><label>Instructions / description</label><textarea rows={2} value={form.subtitle} onChange={e=>change(f=>({...f,subtitle:e.target.value}))}/></div><div className="field"><label>Form type</label><select value={form.kind} onChange={e=>change(f=>({...f,kind:e.target.value as FormSchema['kind']}))}><option value="agent">Agent recruitment</option><option value="student">Student enrollment</option><option value="custom">Custom</option></select></div><div className="field"><label>Visibility</label><select value={String(form.published)} onChange={e=>change(f=>({...f,published:e.target.value==='true'}))}><option value="false">Draft / Unpublished</option><option value="true">Published / Open for applications</option></select></div></div></div>
 {form.sections.map((s,si)=><section className="panel pad-panel editor-section" key={s.id}><div className="editor-section-header"><strong>Section {si+1}</strong><div className="icon-actions"><button title="Move up" onClick={()=>sectionMove(si,-1)}><ArrowUp size={17}/></button><button title="Move down" onClick={()=>sectionMove(si,1)}><ArrowDown size={17}/></button><button title="Delete section" disabled={form.sections.length===1} onClick={()=>change(f=>{f.sections.splice(si,1);return f;})}><Trash2 size={17}/></button></div></div><div className="field"><label>Section title</label><input value={s.title} onChange={e=>sectionChange(si,'title',e.target.value)}/></div><div className="field"><label>Description (optional)</label><input value={s.description||''} onChange={e=>sectionChange(si,'description',e.target.value)}/></div>
 {s.fields.map((field,fi)=><div className="field-editor" key={field.id}><div className="field-editor-head"><span>Question {fi+1}</span><div className="icon-actions"><button title="Move up" onClick={()=>fieldMove(si,fi,-1)}><ArrowUp size={16}/></button><button title="Move down" onClick={()=>fieldMove(si,fi,1)}><ArrowDown size={16}/></button><button title="Duplicate question" onClick={()=>change(f=>{f.sections[si].fields.splice(fi+1,0,{...structuredClone(field),id:'f-'+id()});return f;})}><Copy size={16}/></button><button title="Delete question" onClick={()=>change(f=>{f.sections[si].fields.splice(fi,1);return f;})}><Trash2 size={16}/></button></div></div>
 <div className="form-grid"><div className="field full"><label>Question label</label><input value={field.label} onChange={e=>fieldChange(si,fi,'label',e.target.value)}/></div><div className="field"><label>Response type</label><select value={field.type} onChange={e=>fieldChange(si,fi,'type',e.target.value)}>{types.map(t=><option value={t} key={t}>{t}</option>)}</select></div><div className="field"><label>Internal field key</label><input value={field.id} onChange={e=>fieldChange(si,fi,'id',e.target.value)}/></div><div className="field full"><label>Help text</label><input value={field.description||''} onChange={e=>fieldChange(si,fi,'description',e.target.value)}/></div>{['select','radio','checkbox'].includes(field.type)&&<div className="field"><label>Options data source</label><select value={field.optionsSource||''} onChange={e=>fieldChange(si,fi,'optionsSource',e.target.value||undefined)}><option value="">Manually entered options</option><option value="programmes">Published Firestore programmes</option><option value="intakes">Admin-managed intakes</option></select></div>}{['select','radio','checkbox'].includes(field.type)&&!field.optionsSource&&<div className="field full"><label>Options (one per line)</label><textarea rows={4} value={(field.options||[]).join('\n')} onChange={e=>fieldChange(si,fi,'options',e.target.value.split('\n').map(x=>x.trim()).filter(Boolean))}/></div>}
 <div className="field"><label>Show only if a previous answer equals</label><select value={field.condition?.fieldId||''} onChange={e=>fieldChange(si,fi,'condition',e.target.value?{fieldId:e.target.value,equals:''}:undefined)}><option value="">Always visible</option>{all.slice(0,all.findIndex(f=>f.id===field.id)).map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></div>{field.condition&&<div className="field"><label>Expected answer</label><input value={field.condition.equals} onChange={e=>fieldChange(si,fi,'condition',{...field.condition!,equals:e.target.value})}/></div>}
 <label className="required-toggle"><input type="checkbox" checked={field.required} onChange={e=>fieldChange(si,fi,'required',e.target.checked)}/> Answer required</label></div></div>)}<button className="btn btn-outline" onClick={()=>change(f=>{f.sections[si].fields.push({id:'f-'+id(),label:'New question',type:'text',required:false});return f;})}><Plus size={15}/> Add question</button>
 </section>)}<button className="btn btn-secondary" onClick={()=>change(f=>{f.sections.push({id:'s-'+id(),title:'New section',fields:[]});return f;})}><Plus size={17}/> Add section</button>
 </div><aside className="editor-aside"><div className="panel pad-panel"><h3>Publication</h3><p>Use Draft while editing. Publish once the questions and privacy notices are approved.</p><div className="summary-pair"><span>Questions</span><strong>{all.length}</strong></div><div className="summary-pair"><span>Sections</span><strong>{form.sections.length}</strong></div><div className="summary-pair"><span>Current version</span><strong>v{form.version}</strong></div><button className="btn btn-primary btn-full" disabled={busy} onClick={()=>void save()}><Save size={16}/> Save form</button><button className="btn btn-outline btn-full" style={{marginTop:12,color:'#ef4444',borderColor:'rgba(239,68,68,0.3)'}} disabled={busy} onClick={()=>setConfirmDelete(true)}><Trash2 size={16}/> Delete form</button>{err&&<p className="error-text">{err}</p>}{saved&&<p className="success-text">{saved}</p>}</div></aside></div>
 <ConfirmModal
  isOpen={confirmDelete}
  title="Delete Form Permanently"
  message={`Are you sure you want to permanently delete form "${form?.title}"? This action cannot be undone.`}
  kind="danger"
  confirmLabel="Delete Form"
  cancelLabel="Cancel"
  busy={busy}
  onConfirm={()=>void deleteThisForm()}
  onCancel={()=>setConfirmDelete(false)}
 />
 </>;
}
