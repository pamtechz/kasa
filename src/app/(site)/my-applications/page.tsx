'use client';
import {useEffect,useState} from 'react';
import {onAuthStateChanged,signOut} from 'firebase/auth';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {auth,authHeaders,appCheckToken,firebaseConfigured} from '@/lib/firebase-client';
import {StatusBadge} from '@/components/Portal';
type ApplicantItem={id:string;reference:string;formTitle:string;status:string;submittedAt:string;fundingMethod:string|null};
export default function MyApplications(){
 const [email,setEmail]=useState(''),[items,setItems]=useState<ApplicantItem[]>([]),[reference,setReference]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const router=useRouter();
 async function load(){
  const headers=await authHeaders();
  const res=await fetch('/api/student/applications',{headers});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Unable to load applications');
  setItems(data.applications);setEmail(data.email);
 }
 useEffect(()=>{if(!firebaseConfigured)return;return onAuthStateChanged(auth,user=>{if(!user)router.replace('/login?next=%2Fmy-applications');else void load().catch(e=>setError(e.message));});},[router]);
 async function claim(){
  setError('');setMessage('');setBusy(true);
  try{
   const headers=await authHeaders(),token=await appCheckToken();
   const res=await fetch('/api/student/applications',{method:'POST',headers:{...headers,'Content-Type':'application/json',...(token?{'X-Firebase-AppCheck':token}:{})},body:JSON.stringify({reference})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Unable to link your application.');
   setReference('');setMessage('Application linked to your verified email account.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Unable to link application.');}finally{setBusy(false);}
 }
 return <SiteChrome><PageIntro eyebrow="PRIVATE STUDENT PORTAL" title="My applications" description="Review your own KASA application references and the latest review status."/>
 <main className="container site-content">
 <div className="panel pad-panel"><h2>Your account</h2><p>Verified address: <strong>{email||'Checking login…'}</strong></p><button className="btn btn-outline" onClick={()=>void signOut(auth).then(()=>router.push('/login'))}>Sign out</button></div>
 <div className="panel pad-panel"><h2>Link an earlier application</h2><p>Use the reference from your submission confirmation. For security, the application's submitted email must exactly match your verified sign-in email.</p><div className="inline-form"><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="KASA-2026-1234ABCD"/><button disabled={busy||!reference} className="btn btn-primary" onClick={()=>void claim()}>{busy?'Verifying…':'Link application'}</button></div>{error&&<div className="alert-error">{error}</div>}{message&&<div className="notice">{message}</div>}</div>
 <div className="panel"><div className="panel-title"><div><h2>My enrollment status</h2><p>Only applications verified as belonging to your account appear here.</p></div><Link className="text-link" href="/admissions">Admissions information</Link></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Reference</th><th>Application</th><th>Submitted</th><th>Status</th><th>Funding</th></tr></thead><tbody>{items.map(a=><tr key={a.id}><td><strong>{a.reference}</strong></td><td>{a.formTitle}</td><td>{new Date(a.submittedAt).toLocaleDateString()}</td><td><StatusBadge status={a.status}/></td><td>{a.fundingMethod==='cdf'?'Government CDF sponsorship':a.fundingMethod==='self_funded'?'Self-funded':'Not verified yet'}</td></tr>)}{!items.length&&<tr><td colSpan={5} className="empty-state">No linked applications. Complete an official form or link a previous submission above.</td></tr>}</tbody></table></div></div>
 </main></SiteChrome>;
}
