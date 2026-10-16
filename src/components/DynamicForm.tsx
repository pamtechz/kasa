'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,LoaderCircle,Paperclip,ShieldCheck} from 'lucide-react';
import type {Field,FormSchema} from '@/lib/types';
import {appCheckToken,auth} from '@/lib/firebase-client';
function valString(v:unknown){return typeof v==='string'?v:'';}
export function DynamicForm({form,agentCode}:{form:FormSchema;agentCode?:string}){
 const [answers,setAnswers]=useState<Record<string,unknown>>({});
 const [step,setStep]=useState(0);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [reference,setReference]=useState('');
 const [uploading,setUploading]=useState<string|null>(null);
 const sectionHeading=useRef<HTMLHeadingElement>(null);
 const fields=form.sections[step]?.fields||[];
 useEffect(()=>{if(step>0)sectionHeading.current?.focus();},[step]);
 const visible=useMemo(()=>fields.filter(f=>!f.condition||String(answers[f.condition.fieldId]??'')===f.condition.equals),[fields,answers]);
 const update=(id:string,val:unknown)=>{setAnswers(prev=>({...prev,[id]:val}));setError('');};
 function validateCurrent(){
  for(const f of visible){const v=answers[f.id];
   if(f.required && (v===undefined||v===null||v===''||(Array.isArray(v)&&!v.length)))return `Please complete: ${f.label}.`;
   if(v && f.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)))return `Enter a valid email: ${f.label}.`;
  }
  return '';
 }
 async function uploadFile(f:Field,file?:File){
  if(!file)return;
  setError('');setUploading(f.id);
  try{
   if(file.size>4*1024*1024)throw Error('File must not exceed 4 MB.');
   if(!['application/pdf','image/jpeg','image/png'].includes(file.type))throw Error('Choose a PDF, JPG or PNG document.');
   const data=new FormData();data.append('file',file);
   const token=await appCheckToken();
   const res=await fetch('/api/public/upload',{method:'POST',headers:token?{'X-Firebase-AppCheck':token}:{},body:data});
   const body=await res.json();if(!res.ok)throw Error(body.error||'Unable to upload file.');
   update(f.id,body);
  }catch(e){setError(e instanceof Error?e.message:'Upload failed.');}finally{setUploading(null);}
 }
 async function submit(){
  const err=validateCurrent();if(err){setError(err);return;}
  if(step<form.sections.length-1){setStep(step+1);setError('');return;}
  setBusy(true);setError('');
  try{
   const token=await appCheckToken();
   const idToken=auth?.currentUser&&form.kind==='student'?await auth.currentUser.getIdToken():'';
   const res=await fetch(`/api/public/forms/${encodeURIComponent(form.slug)}/submit`,{
    method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Firebase-AppCheck':token}:{}),...(idToken?{'Authorization':'Bearer '+idToken}:{})},
    body:JSON.stringify({formVersion:form.version,answers,agentCode:agentCode||undefined})
   });
   const out=await res.json();if(!res.ok)throw Error(out.error||'Submission failed.');
   setReference(out.reference);
  }catch(e){setError(e instanceof Error?e.message:'Submission failed.');}finally{setBusy(false);}
 }
 if(reference)return <section className="form-success"><CheckCircle2 size={56}/><h2>Application received</h2><p>Your form was submitted successfully. Keep your reference number for follow-up with KASA.</p><div className="reference">{reference}</div><a href="/" className="btn btn-primary">Back to KASA</a></section>;
 return <div className="form-panel">
  <div className="form-intro"><span className="overline">KASA · ONLINE APPLICATION</span><h1>{form.title}</h1><p>{form.subtitle}</p></div>
  <div className="step-progress"><div className="step-copy"><strong>Step {step+1} of {form.sections.length}</strong><span>{form.sections[step].title}</span></div><div className="progress-track" role="progressbar" aria-label="Application progress" aria-valuemin={0} aria-valuemax={form.sections.length} aria-valuenow={step+1}><div style={{width:`${(step+1)/form.sections.length*100}%`}}/></div></div>
  <div className="form-fields"><h2 ref={sectionHeading} tabIndex={-1}>{form.sections[step].title}</h2>{form.sections[step].description&&<p className="muted">{form.sections[step].description}</p>}
  {visible.map(f=><div className="field" key={f.id}><label htmlFor={f.id}>{f.label}{f.required&&<b className="required"> *</b>}</label>{f.description&&<p className="field-hint">{f.description}</p>}
   {['text','tel','email','number','date'].includes(f.type)&&<input id={f.id} type={f.type==='tel'?'tel':f.type} placeholder={f.placeholder||''} value={valString(answers[f.id])} required={f.required} onChange={e=>update(f.id,e.target.value)}/>}
   {f.type==='textarea'&&<textarea id={f.id} rows={4} value={valString(answers[f.id])} placeholder={f.placeholder||''} onChange={e=>update(f.id,e.target.value)}/>}
   {f.type==='select'&&<select id={f.id} value={valString(answers[f.id])} onChange={e=>update(f.id,e.target.value)}><option value="">Choose an option</option>{f.options?.map((o,i)=><option key={i} value={o}>{o}</option>)}</select>}
   {f.type==='radio'&&<div className="choice-stack">{f.options?.map((o,i)=><label className="choice" key={i}><input type="radio" name={f.id} checked={answers[f.id]===o} onChange={()=>update(f.id,o)}/>{o}</label>)}</div>}
   {f.type==='checkbox'&&<div className="choice-stack">{f.options?.map((o,i)=><label className="choice" key={i}><input type="checkbox" checked={Array.isArray(answers[f.id])&&(answers[f.id] as string[]).includes(o)} onChange={e=>update(f.id,e.target.checked?[...(Array.isArray(answers[f.id])?answers[f.id] as string[]:[]),o]:(answers[f.id] as string[]||[]).filter(x=>x!==o))}/>{o}</label>)}</div>}
   {f.type==='file'&&<div className="upload-box"><label htmlFor={f.id+'-upload'}><Paperclip size={17}/> {uploading===f.id?'Uploading…':answers[f.id]?'Replace attachment':'Choose PDF, JPG or PNG'} <span>Max 4 MB</span></label><input id={f.id+'-upload'} type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={busy||uploading!==null} onChange={e=>void uploadFile(f,e.target.files?.[0])}/>{Boolean(answers[f.id])&&<small>Uploaded: {(answers[f.id] as {fileName:string}).fileName}</small>}</div>}
  </div>)}
  </div>
  {error&&<div className="alert-error" role="alert">{error}</div>}
  <div className="form-footer"><button type="button" className="btn btn-ghost" onClick={()=>{setStep(s=>Math.max(0,s-1));setError('');}} disabled={!step||busy}><ArrowLeft size={16}/> Back</button><button type="button" className="btn btn-primary" onClick={()=>void submit()} disabled={busy||uploading!==null} aria-label={step===form.sections.length-1?'Submit application':'Continue to next section'}>{busy?<LoaderCircle className="spin" size={17}/>:step===form.sections.length-1?'Submit application':'Continue'} <ArrowRight size={16}/></button></div>
  <div className="form-security"><ShieldCheck size={17}/> Your information is transmitted securely and accessible only to authorized KASA personnel.</div>
 </div>;
}
