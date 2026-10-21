'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {signInWithEmailAndPassword,updatePassword} from 'firebase/auth';
import {
 ArrowLeft,ArrowRight,CheckCircle2,LoaderCircle,Paperclip,
 ShieldCheck,Image as ImageIcon,FileDown,LockKeyhole,Copy,KeyRound,Check,Users
} from 'lucide-react';
import type {Field,FormSchema} from '@/lib/types';
import {appCheckToken,auth,requireClientAuth} from '@/lib/firebase-client';
import {PasswordInput} from '@/components/PasswordInput';

function valString(v:unknown){return typeof v==='string'?v:'';}

export function DynamicForm({form,agentCode}:{form:FormSchema;agentCode?:string}){
 const [answers,setAnswers]=useState<Record<string,unknown>>({});
 const [step,setStep]=useState(0);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [reference,setReference]=useState('');
 const [submissionResult,setSubmissionResult]=useState<{
  reference:string;
  autoApproved?:boolean;
  status?:string;
  fundingMethod?:string;
  letterUrl?:string;
  enrollmentFormUrl?:string;
  accountCreated?:boolean;
  tempPassword?:string;
  studentEmail?:string;
  mustChangePassword?:boolean;
 }|null>(null);

 const [userLoggedInAndVerified,setUserLoggedInAndVerified]=useState(false);
 const [tempPassInput,setTempPassInput]=useState('');
 const [newPassInput,setNewPassInput]=useState('');
 const [confirmPassInput,setConfirmPassInput]=useState('');
 const [loginBusy,setLoginBusy]=useState(false);
 const [loginError,setLoginError]=useState('');
 const [copiedTempPass,setCopiedTempPass]=useState(false);

 const [uploading,setUploading]=useState<string|null>(null);
 const sectionHeading=useRef<HTMLHeadingElement>(null);

 useEffect(()=>{if(step>0)sectionHeading.current?.focus();},[step]);

 const visible=useMemo(()=>{
  const fields=form.sections[step]?.fields||[];
  return fields.filter(f=>!f.condition||String(answers[f.condition.fieldId]??'')===f.condition.equals);
 },[form.sections,step,answers]);

 const unavailableOptions=visible.filter(f=>['select','radio','checkbox'].includes(f.type)&&!f.options?.length);
 const availableChoices=unavailableOptions.length===0;

 const update=(id:string,val:unknown)=>{setAnswers(prev=>({...prev,[id]:val}));setError('');};

 function validateCurrent(){
  if(!availableChoices)return 'A required course or intake is not currently available. Please contact KASA admissions.';
  for(const f of visible){
   const v=answers[f.id];
   if(f.required && (v===undefined||v===null||v===''||(Array.isArray(v)&&!v.length)))return `Please complete: ${f.label}.`;
   if(v && f.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)))return `Enter a valid email: ${f.label}.`;
   if(v && f.type==='image'&&!/^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\/.+/i.test(String(v)))return `Uploading images must be from https://console.cloudinary.com/app strictly (URL must start with https://res.cloudinary.com/): ${f.label}.`;
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
    method:'POST',
    headers:{'Content-Type':'application/json',...(token?{'X-Firebase-AppCheck':token}:{}),...(idToken?{'Authorization':'Bearer '+idToken}:{})},
    body:JSON.stringify({formVersion:form.version,answers,agentCode:agentCode||undefined})
   });
   const out=await res.json();if(!res.ok)throw Error(out.error||'Submission failed.');
   setSubmissionResult(out);
   setReference(out.reference);
   if(out.tempPassword){
    setTempPassInput(out.tempPassword);
   }
   if(!out.tempPassword && !out.mustChangePassword){
    setUserLoggedInAndVerified(true);
   }
  }catch(e){setError(e instanceof Error?e.message:'Submission failed.');}finally{setBusy(false);}
 }

 async function handleInitialLoginAndPasswordChange(e:React.FormEvent){
  e.preventDefault();
  setLoginError('');
  if(!newPassInput||newPassInput.length<8){
   setLoginError('Your new permanent password must be at least 8 characters long.');
   return;
  }
  if(newPassInput!==confirmPassInput){
   setLoginError('New password and confirmation do not match.');
   return;
  }
  setLoginBusy(true);
  try{
   const firebaseAuth=requireClientAuth();
   const pwdToUse=tempPassInput||submissionResult?.tempPassword||'';
   const emailToUse=submissionResult?.studentEmail||'';
   if(!emailToUse||!pwdToUse)throw Error('Missing sign-in credentials.');

   const cred=await signInWithEmailAndPassword(firebaseAuth,emailToUse,pwdToUse);
   await updatePassword(cred.user,newPassInput);

   const idToken=await cred.user.getIdToken();
   await fetch('/api/profile',{
    method:'PATCH',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${idToken}`},
    body:JSON.stringify({mustChangePassword:false})
   });

   setUserLoggedInAndVerified(true);
  }catch(err){
   setLoginError(err instanceof Error?err.message:'Initial login or password update failed. Check your password.');
  }finally{
   setLoginBusy(false);
  }
 }

 const copyTempPassword=async()=>{
  if(!submissionResult?.tempPassword)return;
  await navigator.clipboard.writeText(submissionResult.tempPassword);
  setCopiedTempPass(true);
  setTimeout(()=>setCopiedTempPass(false),2500);
 };

 if(reference){
  // If account was created with a temporary password and user has NOT logged in and updated password yet:
  if(submissionResult?.tempPassword && !userLoggedInAndVerified){
   return (
    <section className="form-panel" style={{maxWidth:600,margin:'40px auto',padding:'36px 32px'}}>
     <div className="form-intro" style={{textAlign:'center',paddingBottom:20}}>
      <div style={{display:'inline-flex',padding:14,borderRadius:'50%',background:'#eaf4ee',color:'var(--green)',marginBottom:12}}>
       <LockKeyhole size={36}/>
      </div>
      <span className="overline" style={{color:'var(--gold)',fontWeight:800}}>STEP 2: ACCOUNT VERIFICATION & PASSWORD RESET</span>
      <h2 style={{fontSize:22,fontWeight:800,margin:'8px 0'}}>Your Temporary Student Account Is Ready</h2>
      <p style={{fontSize:14,lineHeight:1.6,color:'var(--muted)'}}>
       A KASA student account has been created for <strong>{submissionResult.studentEmail}</strong>. Use your temporary password below and set your new permanent password to log in and access your application results.
      </p>
     </div>

     <div style={{background:'#f4faf6',border:'1px dashed #a2cfb4',padding:16,borderRadius:12,margin:'20px 0',textAlign:'center'}}>
      <span className="muted font-xs" style={{display:'block',marginBottom:4,textTransform:'uppercase',fontWeight:700}}>Randomized Temporary Password</span>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
       <code style={{fontSize:20,fontWeight:800,letterSpacing:'0.06em',color:'var(--green)'}}>{submissionResult.tempPassword}</code>
       <button type="button" onClick={()=>void copyTempPassword()} className="btn btn-ghost" style={{padding:'6px 10px',fontSize:12}}>
        {copiedTempPass?<Check size={16} color="var(--green)"/>:<Copy size={16}/>}
        <span>{copiedTempPass?'Copied!':'Copy'}</span>
       </button>
      </div>
     </div>

     <form onSubmit={e=>void handleInitialLoginAndPasswordChange(e)} style={{display:'grid',gap:16}}>
      <div className="field">
       <label htmlFor="tempPassInput">Temporary Password</label>
       <input id="tempPassInput" type="text" value={tempPassInput} onChange={e=>setTempPassInput(e.target.value)} required/>
      </div>

      <PasswordInput label="Set New Permanent Password (Min. 8 characters)" name="newPassInput" minLength={8} value={newPassInput} onChange={e=>setNewPassInput(e.target.value)} required/>
      <PasswordInput label="Confirm New Password" name="confirmPassInput" minLength={8} value={confirmPassInput} onChange={e=>setConfirmPassInput(e.target.value)} required/>

      {loginError&&<div className="alert-error" role="alert">{loginError}</div>}

      <button className="btn btn-primary btn-full" disabled={loginBusy} style={{marginTop:10}}>
       {loginBusy?'Logging in & Updating Password…':'Sign In & Complete Application Verification'} <KeyRound size={16}/>
      </button>
     </form>
    </section>
   );
  }

  // Once verified or if user was already signed in:
  if(submissionResult?.autoApproved) {
   return (
    <section className="form-success auto-approved-card" style={{maxWidth:640,margin:'40px auto',padding:'36px 28px',background:'var(--card-bg, #fff)',borderRadius:16,border:'2px solid #2e7d32',boxShadow:'0 16px 40px rgba(46,125,50,0.12)',textAlign:'center'}}>
     <div style={{display:'inline-flex',padding:14,borderRadius:'50%',background:'#e8f5e9',color:'#2e7d32',marginBottom:16}}>
      <CheckCircle2 size={48}/>
     </div>
     <div style={{display:'inline-block',padding:'4px 14px',borderRadius:20,background:'#2e7d32',color:'#fff',fontSize:12,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:12}}>
      Auto-Approved Application
     </div>
     <h2 style={{color:'#1b5e20',fontSize:24,fontWeight:800,marginBottom:8}}>
      Congratulations! Your Application Is Approved
     </h2>
     <p style={{color:'var(--text-muted, #555)',fontSize:15,lineHeight:1.6,marginBottom:20}}>
      Your KASA admission has been automatically approved and your student account is verified. You can immediately download your official acceptance pack and completed enrollment form below.
     </p>
     <div className="reference" style={{margin:'0 auto 24px',fontSize:20,fontWeight:700,letterSpacing:'0.05em',background:'#f1f8e9',border:'1px dashed #2e7d32',padding:'10px 20px',borderRadius:8,display:'inline-block',color:'#1b5e20'}}>
      Ref: {reference}
     </div>
     <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:24}}>
      {submissionResult.letterUrl && (
       <a href={submissionResult.letterUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,padding:'12px 20px',fontSize:15,fontWeight:600,borderRadius:8,background:'#1b5e20',color:'#fff',textDecoration:'none'}}>
        <FileDown size={18}/> Download Official Acceptance Pack & Letter (PDF)
       </a>
      )}
      {submissionResult.enrollmentFormUrl && (
       <a href={submissionResult.enrollmentFormUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,padding:'12px 20px',fontSize:15,fontWeight:600,borderRadius:8,border:'2px solid #1b5e20',color:'#1b5e20',textDecoration:'none',background:'transparent'}}>
        <FileDown size={18}/> Download Completed Enrollment Form (PDF)
       </a>
      )}
     </div>
     <div style={{background:'#f9fafb',padding:14,borderRadius:8,fontSize:13,color:'#666',lineHeight:1.5,marginBottom:20,textAlign:'left'}}>
      <strong>Next steps:</strong>
      <ol style={{margin:'6px 0 0 18px',padding:0}}>
       <li>Download and print your Acceptance Form and Enrollment Form.</li>
       <li>Sign the student declaration (and parent/guardian signature if under 18).</li>
       <li>Bring your signed forms and original NRC/ID when reporting to Kamaila Campus, Chisamba.</li>
      </ol>
     </div>
     <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
      <Link href="/my-applications" className="btn btn-primary" style={{textDecoration:'none'}}>Go to My Student Applications</Link>
      <Link href="/" className="btn btn-ghost" style={{textDecoration:'none'}}>Back to KASA Home</Link>
     </div>
    </section>
   );
  }

  return (
   <section className="form-success" style={{maxWidth:600,margin:'40px auto',padding:'36px 28px',background:'var(--card-bg, #fff)',borderRadius:16,border:'1px solid var(--border-color, #e0e0e0)',boxShadow:'0 10px 30px rgba(0,0,0,0.06)',textAlign:'center'}}>
    <CheckCircle2 size={56} style={{color:'var(--primary, #1b5e20)',marginBottom:16}}/>
    <h2 style={{fontSize:24,fontWeight:800,marginBottom:8}}>Application Submitted & Verified</h2>
    <p style={{color:'var(--text-muted, #555)',fontSize:15,lineHeight:1.6,marginBottom:16}}>
     Your form was submitted successfully and your student account is verified. It is currently under review by the KASA Admissions Office. Keep your reference number for follow-up.
    </p>
    <div className="reference" style={{margin:'0 auto 20px',fontSize:20,fontWeight:700,letterSpacing:'0.05em',background:'#f5f5f5',border:'1px dashed #999',padding:'10px 20px',borderRadius:8,display:'inline-block'}}>
     Ref: {reference}
    </div>
    {submissionResult?.enrollmentFormUrl && (
     <div style={{marginBottom:24}}>
      <a href={submissionResult.enrollmentFormUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,padding:'10px 18px',fontSize:14,fontWeight:600,borderRadius:8,border:'1px solid #1b5e20',color:'#1b5e20',textDecoration:'none'}}>
       <FileDown size={17}/> Download Completed Enrollment Form (PDF)
      </a>
     </div>
    )}
    <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
     <Link href="/my-applications" className="btn btn-primary" style={{textDecoration:'none'}}>Go to My Student Applications</Link>
     <Link href="/" className="btn btn-ghost" style={{textDecoration:'none'}}>Back to KASA Home</Link>
    </div>
   </section>
  );
 }

 return <div className="form-panel">
  <div className="form-intro"><span className="overline">KASA · OFFICIAL ONLINE APPLICATION</span><h1>{form.title}</h1><p>{form.subtitle}</p></div>

  {/* Visual Step Pills Progress Bar */}
  <div className="step-progress" style={{marginBottom: 20}}>
   <div style={{display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 10}}>
    {form.sections.map((sec, idx) => {
     const isDone = idx < step;
     const isCurrent = idx === step;
     return (
      <div
       key={sec.id}
       onClick={() => isDone && setStep(idx)}
       style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20,
        background: isCurrent ? 'var(--green, #103f2c)' : isDone ? '#eaf4ee' : '#f1f5f3',
        color: isCurrent ? '#ffffff' : isDone ? 'var(--green)' : 'var(--muted)',
        fontSize: 12, fontWeight: 700, cursor: isDone ? 'pointer' : 'default', whiteSpace: 'nowrap'
       }}
      >
       {isDone ? <Check size={14} /> : <span style={{width: 18, height: 18, borderRadius: '50%', background: isCurrent ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10}}>{idx + 1}</span>}
       <span>{sec.title}</span>
      </div>
     );
    })}
   </div>
   <div className="progress-track" role="progressbar" aria-label="Application progress" aria-valuemin={0} aria-valuemax={form.sections.length} aria-valuenow={step+1}>
    <div style={{width:`${(step+1)/form.sections.length*100}%`}}/>
   </div>
  </div>
  <div className="form-fields"><h2 ref={sectionHeading} tabIndex={-1}>{form.sections[step].title}</h2>{form.sections[step].description&&<p className="muted">{form.sections[step].description}</p>}
  {step === 0 && (
   <div className="field full" style={{background: 'rgba(16,63,44,0.03)', padding: 14, borderRadius: 10, border: '1px solid var(--border)', margin: '12px 0 16px'}}>
    <label style={{fontSize: 13, fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4}}>
     <Users size={16} /> Were you referred by a KASA District Agent or Student?
    </label>
    {agentCode ? (
     <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13, color: 'var(--green)', fontWeight: 700}}>
      <CheckCircle2 size={16} /> Attributed to Referral Code: <span className="copy-code">{agentCode}</span>
     </div>
    ) : (
     <div style={{marginTop: 6}}>
      <input
       type="text"
       placeholder="Enter District Agent Code, Student Referral Code, or Agent Name (optional)"
       value={valString(answers['referralCode'])}
       onChange={e => update('referralCode', e.target.value.toUpperCase())}
       style={{fontSize: 13, width: '100%'}}
      />
      <small className="field-hint">Leave blank if applying directly without a referral agent.</small>
     </div>
    )}
   </div>
  )}
  {!availableChoices&&<div className="notice" role="alert"><strong>Choices not available yet.</strong> KASA has not published an active option for {unavailableOptions.map(f=>f.label).join(', ')}. You can return after KASA updates the catalogue or <Link href="/contact">contact admissions</Link>.</div>}
  {visible.map(f=><div className="field" key={f.id}><label htmlFor={f.id}>{f.label}{f.required&&<b className="required"> *</b>}</label>{f.description&&<p className="field-hint">{f.description}</p>}
   {['text','tel','email','number','date'].includes(f.type)&&<input id={f.id} type={f.type==='tel'?'tel':f.type} placeholder={f.placeholder||''} value={valString(answers[f.id])} required={f.required} onChange={e=>update(f.id,e.target.value)}/>}
   {f.type==='textarea'&&<textarea id={f.id} rows={4} value={valString(answers[f.id])} placeholder={f.placeholder||''} onChange={e=>update(f.id,e.target.value)}/>}
   {f.type==='select'&&<select id={f.id} value={valString(answers[f.id])} onChange={e=>update(f.id,e.target.value)}><option value="">Choose an option</option>{f.options?.map((o,i)=><option key={i} value={o}>{o}</option>)}</select>}
   {f.type==='radio'&&<div className="choice-stack">{f.options?.map((o,i)=><label className="choice" key={i}><input type="radio" name={f.id} checked={answers[f.id]===o} onChange={()=>update(f.id,o)}/>{o}</label>)}</div>}
   {f.type==='checkbox'&&<div className="choice-stack">{f.options?.map((o,i)=><label className="choice" key={i}><input type="checkbox" checked={Array.isArray(answers[f.id])&&(answers[f.id] as string[]).includes(o)} onChange={e=>update(f.id,e.target.checked?[...(Array.isArray(answers[f.id])?answers[f.id] as string[]:[]),o]:(answers[f.id] as string[]||[]).filter(x=>x!==o))}/>{o}</label>)}</div>}
   {f.type==='image'&&<div className="cloudinary-box">
     <div className="cloudinary-box-header">
      <label htmlFor={f.id}><ImageIcon size={16}/> Cloudinary Image URL (strictly from https://console.cloudinary.com/app)</label>
      <a href="https://console.cloudinary.com/app" target="_blank" rel="noopener noreferrer" className="cloudinary-link-btn">Open Cloudinary Console ↗</a>
     </div>
     <p className="field-hint">Uploading images must be from <a href="https://console.cloudinary.com/app" target="_blank" rel="noopener noreferrer" style={{textDecoration:'underline',fontWeight:700}}>https://console.cloudinary.com/app</a> strictly. Paste your asset URL below (must start with <code>https://res.cloudinary.com/</code>).</p>
     <input id={f.id} type="url" placeholder="https://res.cloudinary.com/your-cloud/image/upload/v.../photo.jpg" value={valString(answers[f.id])} onChange={e=>update(f.id,e.target.value)}/>
     {valString(answers[f.id])&&/^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\/.+/i.test(valString(answers[f.id]))?(
      <div className="cloudinary-preview">
       <Image src={valString(answers[f.id])} alt={f.label} width={60} height={60} unoptimized/>
       <div><strong style={{color:'var(--green)',fontSize:12,display:'block'}}>✓ Verified Cloudinary image link</strong><small className="muted">Source: console.cloudinary.com/app</small></div>
      </div>
     ):valString(answers[f.id])?(
      <small style={{color:'#cf633d',display:'block',marginTop:6,fontWeight:600}}>
       Uploading images must be from https://console.cloudinary.com/app strictly (URL must start with https://res.cloudinary.com/)
      </small>
     ):null}
    </div>}
    {f.type==='file'&&<div className="upload-box"><label htmlFor={f.id+'-upload'}><Paperclip size={17}/> {uploading===f.id?'Uploading…':answers[f.id]?'Replace attachment':'Choose PDF, JPG or PNG'} <span>Max 4 MB</span></label><input id={f.id+'-upload'} type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={busy||uploading!==null} onChange={e=>void uploadFile(f,e.target.files?.[0])}/>{Boolean(answers[f.id])&&<small>Uploaded: {(answers[f.id] as {fileName:string}).fileName}</small>}</div>}
  </div>)}
  </div>
  {error&&<div className="alert-error" role="alert">{error}</div>}
  <div className="form-footer"><button type="button" className="btn btn-ghost" onClick={()=>{setStep(s=>Math.max(0,s-1));setError('');}} disabled={!step||busy}><ArrowLeft size={16}/> Back</button><button type="button" className="btn btn-primary" onClick={()=>void submit()} disabled={busy||uploading!==null||!availableChoices} aria-label={step===form.sections.length-1?'Submit application':'Continue to next section'}>{busy?<LoaderCircle className="spin" size={17}/>:step===form.sections.length-1?'Submit application':'Continue'} <ArrowRight size={16}/></button></div>
  <div className="form-security"><ShieldCheck size={17}/> Your information is transmitted securely and accessible only to authorized KASA personnel.</div>
 </div>;
}
