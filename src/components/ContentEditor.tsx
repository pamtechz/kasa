'use client';
import {useEffect,useState,useCallback} from 'react';
import {Save,Plus,Trash2,Search,ExternalLink} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import type {Programme,Announcement} from '@/lib/content';
type Type='programmes'|'announcements';
const emptyProgramme:Programme={
 id:'',title:'',description:'',published:false,category:'short-course',duration:'',durationHours:null,
 requirements:'',certification:'',modules:[],fee:{tuition:null,practical:null,administration:null,foodOptional:null,accommodationOptional:null,packageTotal:null,currency:'ZMW',note:''}
};
const emptyAnnouncement:Announcement={id:'',title:'',description:'',published:false,body:'',category:'general',pinned:false,publishedAt:null,expiresAt:null};
function dateInput(s:string|null){if(!s)return '';const d=new Date(s);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export function ContentEditor({kind}:{kind:Type}){
 const [items,setItems]=useState<(Programme|Announcement)[]>([]),[current,setCurrent]=useState<Programme|Announcement|null>(null),[editing,setEditing]=useState(false),[filter,setFilter]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const isProgramme=kind==='programmes';
 const load=useCallback(async()=>{const r=await api<{items:(Programme|Announcement)[]}>('/api/admin/content?kind='+kind);setItems(r.items);},[kind]);
 useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);
 function editField(field:string,value:unknown){setCurrent(p=>p?{...p,[field]:value}:p);}
 function feeField(field:string,value:string){
  setCurrent(p=>p&&'fee' in p?{...p,fee:{...p.fee,[field]:field==='note'?value:(value===''?null:Number(value))}}:p);
 }
 async function save(){
  if(!current)return;setBusy(true);setError('');setMessage('');
  try{
   await api('/api/admin/content',{method:editing?'PUT':'POST',body:JSON.stringify({kind,item:current})});
   setCurrent(null);await load();setMessage('Saved successfully.');
  }catch(e){setError(e instanceof Error?e.message:'Save failed.');}finally{setBusy(false);}
 }
 async function remove(item:Programme|Announcement){
  if(!window.confirm('Delete "'+item.title+'"? This removes the published entry.'))return;
  try{await api('/api/admin/content',{method:'DELETE',body:JSON.stringify({kind,id:item.id})});await load();setMessage('Record deleted.');}
  catch(e){setError(e instanceof Error?e.message:'Delete failed.');}
 }
 return <><PageHeader title={isProgramme?'Programmes and fees':'Announcements'} subtitle={isProgramme?'Maintain courses, entry criteria, module outlines and proposed costs in Firestore.':'Create, publish, pin, schedule and withdraw official institutional announcements.'} action={<button className="btn btn-primary" onClick={()=>{setCurrent(isProgramme?structuredClone(emptyProgramme):structuredClone(emptyAnnouncement));setEditing(false);setError('');}}><Plus size={16}/>Add new</button>}/>
 {error&&<div className="alert-error">{error}</div>}{message&&<div className="notice">{message}</div>}
 <div className="panel"><div className="table-controls"><label className="search-box"><Search size={16}/><input placeholder="Search records" value={filter} onChange={e=>setFilter(e.target.value)}/></label></div>
 <div className="table-scroll"><table className="data-table"><thead><tr><th>Title</th><th>Category</th><th>Publication</th><th>Actions</th></tr></thead><tbody>{items.filter(x=>(x.title+' '+x.description).toLowerCase().includes(filter.toLowerCase())).map(x=><tr key={x.id}><td><strong>{x.title}</strong><small className="table-sub">{x.id}</small></td><td>{x.category}</td><td>{x.published?'Published':'Draft'}</td><td><button className="text-link" onClick={()=>{setCurrent(x);setEditing(true);setError('');}}>Edit</button><button className="text-link" onClick={()=>void remove(x)}><Trash2 size={14}/>Delete</button></td></tr>)}{!items.length&&<tr><td colSpan={4} className="empty-state">No records yet. Use the KASA starter-data tool to populate your initial catalogue.</td></tr>}</tbody></table></div></div>
 {current&&<section className="panel pad-panel"><h2>{editing?'Edit '+current.title:'Create '+(isProgramme?'programme':'announcement')}</h2>
 <div className="form-grid"><div className="field"><label>Permanent URL ID</label><input disabled={editing} value={current.id} onChange={e=>editField('id',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-'))}/></div><div className="field"><label>Title</label><input value={current.title} onChange={e=>editField('title',e.target.value)}/></div></div>
 <div className="field"><label>Short description</label><textarea rows={3} value={current.description} onChange={e=>editField('description',e.target.value)}/></div>
 <label className="required-toggle"><input type="checkbox" checked={current.published} onChange={e=>editField('published',e.target.checked)}/>Publish on KASA public website</label>
 {isProgramme&&'fee' in current?<><div className="form-grid">
  <div className="field"><label>Category</label><select value={current.category} onChange={e=>editField('category',e.target.value)}><option value="main">Main programme</option><option value="agri-sport">AGRI-SPORT pathway</option><option value="short-course">Independent short course</option></select></div>
  <div className="field"><label>Duration</label><input value={current.duration} onChange={e=>editField('duration',e.target.value)}/></div>
  <div className="field"><label>Contact hours (optional)</label><input type="number" min="0" value={current.durationHours??''} onChange={e=>editField('durationHours',e.target.value===''?null:Number(e.target.value))}/></div>
 </div>
 <div className="field"><label>Admission requirements</label><textarea rows={3} value={current.requirements} onChange={e=>editField('requirements',e.target.value)}/></div>
 <div className="field"><label>Certification and qualification status</label><textarea rows={3} value={current.certification} onChange={e=>editField('certification',e.target.value)}/></div>
 <div className="field"><label>Modules or topics (one per line)</label><textarea rows={5} value={current.modules.join('\n')} onChange={e=>editField('modules',e.target.value.split('\n').map(x=>x.trim()).filter(Boolean))}/></div>
 <h3>Fee components in ZMW (leave blank if not confirmed)</h3><div className="form-grid">{(['tuition','practical','administration','foodOptional','accommodationOptional','packageTotal'] as const).map(k=><div className="field" key={k}><label>{({tuition:'Tuition',practical:'Practical',administration:'Administration',foodOptional:'Food (optional)',accommodationOptional:'Accommodation (optional)',packageTotal:'Full proposed package'})[k]}</label><input type="number" min="0" step="0.01" value={current.fee[k]??''} onChange={e=>feeField(k,e.target.value)}/></div>)}</div><div className="field"><label>Fee conditions</label><textarea rows={3} value={current.fee.note} onChange={e=>feeField('note',e.target.value)}/></div>
 </>:'body' in current?<><div className="form-grid"><div className="field"><label>Category</label><select value={current.category} onChange={e=>editField('category',e.target.value)}>{['admissions','academic','cdf','agents','general'].map(c=><option value={c} key={c}>{c}</option>)}</select></div><label className="required-toggle"><input type="checkbox" checked={current.pinned} onChange={e=>editField('pinned',e.target.checked)}/>Pin announcement</label></div><div className="form-grid">
 <div className="field"><label>Publish from (optional)</label><input type="datetime-local" value={dateInput(current.publishedAt)} onChange={e=>editField('publishedAt',e.target.value?new Date(e.target.value).toISOString():null)}/></div>
 <div className="field"><label>Expire at (optional)</label><input type="datetime-local" value={dateInput(current.expiresAt)} onChange={e=>editField('expiresAt',e.target.value?new Date(e.target.value).toISOString():null)}/></div></div><div className="field"><label>Full announcement</label><textarea rows={9} value={current.body} onChange={e=>editField('body',e.target.value)}/></div></>:null}
 <div className="inline-form"><button className="btn btn-primary" disabled={busy} onClick={()=>void save()}><Save size={16}/>Save changes</button><button className="btn btn-outline" onClick={()=>setCurrent(null)}>Cancel</button>{editing&&<a className="text-link" href={'/'+kind+'/'+current.id} target="_blank" rel="noreferrer"><ExternalLink size={15}/>Public page</a>}</div></section>}
 </>;
}
