'use client';
import {useEffect,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {AlertCircle,LogIn,LogOut,RefreshCw,ShieldCheck,Copy,Download,FileText,Share2,Users,Coins,User} from 'lucide-react';
import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {auth,authHeaders,appCheckToken,firebaseConfigured,signOutClient} from '@/lib/firebase-client';
import {StatusBadge} from '@/components/Portal';

type ApplicantItem={id:string;reference:string;formTitle:string;status:string;submittedAt:string;fundingMethod:string|null};
type SessionState='checking'|'guest'|'ready'|'unavailable';
type ReferralItem = {id:string;reference:string;candidateName:string;programme:string;status:string;commissionEarned:number;submittedAt:string};
type ReferralData = {agentCode:string;referralLink:string;referralsCount:number;successfulCount:number;totalEarned:number;referrals:ReferralItem[]};

export default function MyApplications(){
 const [email,setEmail]=useState(''),[items,setItems]=useState<ApplicantItem[]>([]);
 const [reference,setReference]=useState(''),[busy,setBusy]=useState(false);
 const [status,setStatus]=useState<SessionState>('checking');
 const [loadingItems,setLoadingItems]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [referralData,setReferralData]=useState<ReferralData|null>(null);
 const router=useRouter();

 async function load(){
  setLoadingItems(true);
  try{
   const headers=await authHeaders();
   const res=await fetch('/api/student/applications',{headers,cache:'no-store'});
   const data=await res.json();
   if(!res.ok)throw Error(data.error||'Unable to load applications.');
   setItems(Array.isArray(data.applications)?data.applications:[]);
   if(typeof data.email==='string')setEmail(data.email);
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Unable to load applications.');}
  finally{setLoadingItems(false);}
 }
 useEffect(()=>{
  if(!firebaseConfigured||!auth){setStatus('unavailable');return;}
  let live=true;
  const unsubscribe=onAuthStateChanged(auth,user=>{
   if(!live)return;
   if(!user){setEmail('');setItems([]);setStatus('guest');return;}
   if(!user.emailVerified){setError('Verify your email address before viewing private applications.');setStatus('guest');return;}
   setEmail(user.email||'');
   setStatus('ready');
   void load();
  },()=>{
   if(live){setStatus('unavailable');setError('Unable to check your login session. Try refreshing this page.');}
  });
  return ()=>{live=false;unsubscribe();};
 },[]);

 async function logout(){
  setBusy(true);setError('');
  try{
   await signOutClient();
   setEmail('');setItems([]);setStatus('guest');
   router.replace('/login?next=%2Fmy-applications');
  }catch(e){setError(e instanceof Error?e.message:'Unable to sign out. Please try again.');}
  finally{setBusy(false);}
 }
 async function claim(){
  if(status!=='ready')return;
  setError('');setMessage('');setBusy(true);
  try{
   const headers=await authHeaders(),token=await appCheckToken();
   const res=await fetch('/api/student/applications',{
    method:'POST',cache:'no-store',
    headers:{...headers,'Content-Type':'application/json',...(token?{'X-Firebase-AppCheck':token}:{})},
    body:JSON.stringify({reference:reference.trim().toUpperCase()})
   });
   const data=await res.json();
   if(!res.ok)throw Error(data.error||'Unable to link your application.');
   setReference('');setMessage('Your application is now linked to this verified account.');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Unable to link application.');}
  finally{setBusy(false);}
 }
 return <SiteChrome>
 <PageIntro eyebrow="PRIVATE STUDENT PORTAL" title="My applications" description="Track your KASA applications and their review status in one secure place."/>
 <main className="container site-content">
  {status==='checking'&&<section className="panel pad-panel" role="status"><p>Checking your secure session…</p></section>}
  {status==='unavailable'&&<section className="panel pad-panel" role="alert">
   <AlertCircle size={26}/><h2>Student sign-in is unavailable</h2>
   <p>Firebase Authentication has not been initialized for this deployment, or your session could not be checked. No private records have been loaded.</p>
   {error&&<p className="alert-error">{error}</p>}
   <div className="inline-form"><Link className="btn btn-primary" href="/login?next=%2Fmy-applications"><LogIn size={16}/> Sign in</Link><button className="btn btn-outline" type="button" onClick={()=>window.location.reload()}><RefreshCw size={16}/> Retry</button></div>
  </section>}
  {status==='guest'&&<section className="panel pad-panel">
   <ShieldCheck size={28}/><h2>Sign in to view your applications</h2>
   <p>Only applications belonging to your verified email address are visible. You can also link an older application using its reference after signing in.</p>
   {error&&<p className="alert-error">{error}</p>}
   <Link className="btn btn-primary" href="/login?next=%2Fmy-applications"><LogIn size={16}/> Sign in or create an account</Link>
  </section>}
  {status==='ready'&&<>
   <section className="panel pad-panel">
    <div className="student-account-row"><div><h2>Your account</h2><p>Verified email: <strong>{email}</strong></p></div>
    <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'}}><Link href="/account" className="btn btn-secondary"><User size={16}/> Manage profile & password</Link><button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void logout()}><LogOut size={17}/>Sign out</button></div></div>
   </section>
   <section className="panel pad-panel">
    <h2>Link an existing application</h2>
    <p>Enter the reference on your submission receipt. The application email must match your verified sign-in email.</p>
    <div className="inline-form"><input aria-label="KASA application reference" value={reference} onChange={e=>setReference(e.target.value)} placeholder="KASA-2026-1234ABCD" autoComplete="off"/>
    <button type="button" disabled={busy||!reference.trim()} className="btn btn-primary" onClick={()=>void claim()}>{busy?'Verifying…':'Link application'}</button></div>
    {error&&<div className="alert-error" role="alert">{error}</div>}
    {message&&<div className="notice" role="status">{message}</div>}
   </section>
   <section className="panel">
    <div className="panel-title"><div><h2>Enrollment status</h2><p>Your own linked applications, with current review and funding states.</p></div>
     <Link className="text-link" href="/admissions">Admissions information</Link></div>
    {loadingItems?<p className="empty-state" role="status">Loading your applications…</p>:items.length===0?<div className="empty-state">
     <p>No applications are linked to this account yet.</p><Link className="btn btn-outline" href="/admissions">Explore available applications</Link>
    </div>:<div className="table-scroll" tabIndex={0} aria-label="My application records"><table className="data-table"><thead><tr><th>Reference</th><th>Application</th><th>Submitted</th><th>Status</th><th>Funding</th></tr></thead><tbody>
    {items.map(a=><tr key={a.id}><td><strong>{a.reference}</strong></td><td>{a.formTitle}</td><td>{a.submittedAt?new Date(a.submittedAt).toLocaleDateString():'—'}</td><td><StatusBadge status={a.status}/></td><td>{a.fundingMethod==='cdf'?'CDF sponsorship':a.fundingMethod==='self_funded'?'Self-funded':'Not verified yet'}</td></tr>)}
    </tbody></table></div>}
   </section>
  </>}
 </main></SiteChrome>;
}
