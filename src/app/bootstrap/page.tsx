'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {onAuthStateChanged} from 'firebase/auth';
import {CheckCircle2,AlertCircle,ArrowRight,LockKeyhole,Database,Zap} from 'lucide-react';
import {auth,appCheckToken,firebaseConfigured,missingFirebaseBrowserSettings} from '@/lib/firebase-client';
import {BrandLogo} from '@/components/BrandLogo';
import {defaultSite,type SiteSettings} from '@/lib/site';

type Connection={state:'checking'|'configuration_required'|'connected'|'unavailable';initialized?:boolean};
export default function Bootstrap(){
 const [site,setSite]=useState<SiteSettings>(defaultSite);
 const [email,setEmail]=useState('');
 const [verified,setVerified]=useState(false);
 const [connection,setConnection]=useState<Connection>({state:'checking'});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[complete,setComplete]=useState(false);

 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/api/public/site',{cache:'no-store',signal:controller.signal})
   .then(r=>r.ok?r.json():null).then(d=>{if(d?.site)setSite({...defaultSite,...d.site});}).catch(()=>{});
  void fetch('/api/setup/health',{cache:'no-store',signal:controller.signal})
   .then(r=>r.json()).then(d=>{
    if(d?.state==='connected'||d?.state==='unavailable'||d?.state==='configuration_required')
     setConnection({state:d.state,initialized:d.initialized===true});
    else setConnection({state:'unavailable'});
   }).catch(()=>setConnection({state:'unavailable'}));
  return ()=>controller.abort();
 },[]);
 useEffect(()=>{
  if(!firebaseConfigured||!auth)return;
  return onAuthStateChanged(auth,user=>{
   setEmail(user?.email||'');
   setVerified(Boolean(user?.emailVerified));
  });
 },[]);
 async function activate(){
  setBusy(true);setMessage('');
  try{
   const user=auth?.currentUser;
   if(!user)throw Error('Sign in with the nominated administrator email first.');
   await user.reload();
   setVerified(user.emailVerified);
   if(!user.emailVerified)throw Error('Verify your Firebase Authentication email before continuing.');
   const jwt=await user.getIdToken(true);
   // The server requires App Check on production writes, not on localhost.
   // A development-only reCAPTCHA error must not block local setup.
   const appCheck=process.env.NODE_ENV==='production'
    ?await appCheckToken()
    :await appCheckToken().catch(()=>'');
   if(process.env.NODE_ENV==='production'&&!appCheck)
    throw Error('Firebase App Check is not available. Ask KASA to verify its production configuration.');
   const r=await fetch('/api/bootstrap',{
    method:'POST',cache:'no-store',
    headers:{authorization:'Bearer '+jwt,...(appCheck?{'X-Firebase-AppCheck':appCheck}:{})}
   });
   const payload=await r.json();
   if(!r.ok)throw Error(payload.error||'Administrator setup could not be completed.');
   setComplete(true);setMessage('Administrator account initialized successfully.');
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to initialize the administrator account.');}
  finally{setBusy(false);}
 }
 const ready=firebaseConfigured&&verified&&email.length>0&&connection.state==='connected';
 return <div className="bootstrap-root">
  <header className="bootstrap-topbar"><div className="bootstrap-inner">
   <Link href="/" className="bootstrap-identity"><BrandLogo size={54}/><span><strong>KASA</strong><small>Administrator setup</small></span></Link>
   <Link href="/login?next=%2Fbootstrap" className="bootstrap-toplink">Account sign-in <ArrowRight size={16}/></Link>
  </div></header>
  <main className="bootstrap-main bootstrap-inner">
   <div className="bootstrap-heading"><span className="overline">SECURE SYSTEM INITIALIZATION</span>
    <h1>{site.bootstrapTitle||defaultSite.bootstrapTitle}</h1>
    <p>{site.bootstrapDescription||defaultSite.bootstrapDescription}</p>
   </div>
   <div className="bootstrap-layout">
    <section className="bootstrap-panel"><div className="bootstrap-panel-head"><LockKeyhole size={21}/><div><h2>Account verification</h2><p>Confirm the prerequisites before activating the first administrator.</p></div></div>
     <div className="bootstrap-check">
      <span className={email?'bootstrap-check-icon is-good':'bootstrap-check-icon'}>{email?<CheckCircle2 size={19}/>:<AlertCircle size={19}/>}</span>
      <div><strong>Firebase Authentication</strong><p>{email?'Signed in as '+email:'No account signed in. Use your nominated email to sign in.'}</p></div>
     </div>
     <div className="bootstrap-check">
      <span className={verified?'bootstrap-check-icon is-good':'bootstrap-check-icon'}>{verified?<CheckCircle2 size={19}/>:<AlertCircle size={19}/>}</span>
      <div><strong>Email verification</strong><p>{verified?'Your signed-in email is verified.':'Your email must be verified before administrator initialization.'}</p></div>
     </div>
     <div className="bootstrap-check">
      <span className={connection.state==='connected'?'bootstrap-check-icon is-good':'bootstrap-check-icon'}><Database size={19}/></span>
      <div><strong>Firestore connectivity</strong><p>{connection.state==='checking'?'Checking the database…':connection.state==='connected'?'Firestore is reachable.':connection.state==='configuration_required'?'Firebase setup is incomplete in this deployment.':'Database connectivity could not be verified.'}</p></div>
     </div>
     {connection.initialized&&<div className="notice"><CheckCircle2 size={16}/> An initial administrator has already been registered. Existing administrators can use the dashboard.</div>}
     {!firebaseConfigured&&<div className="alert-error" role="alert"><strong>Firebase web-app configuration is missing.</strong>
      <p>Missing browser setting(s): <code>{missingFirebaseBrowserSettings.join(', ')}</code>.</p>
      <p>When testing on your computer, enter your Firebase web-app values in <code>.env.local</code> in the KASA project folder, then fully stop and restart <code>npm run dev</code>. Vercel environment variables are not automatically copied onto your PC.</p>
      <p>See the <a href="https://github.com/pamtechz/kasa/blob/main/docs/LOCAL_FIREBASE_AND_HYDRATION.md" target="_blank" rel="noreferrer">local Firebase setup instructions</a>.</p>
     </div>}
     <div className="bootstrap-actions">
      {email?<button className="btn btn-primary" disabled={!ready||busy||complete} onClick={()=>void activate()}><Zap size={16}/>{busy?'Checking…':complete?'Initialized':'Initialize administrator'}</button>:<Link href="/login?next=%2Fbootstrap" className="btn btn-primary">Sign in or register <ArrowRight size={16}/></Link>}
      <Link href="/dashboard" className="btn btn-outline">Open dashboard</Link>
     </div>
     {message&&<p role="status" className={complete?'notice':'alert-error'}>{message}</p>}
    </section>
    <aside className="bootstrap-aside"><div className="bootstrap-aside-title"><BrandLogo size={62}/><div><span className="overline">INITIAL SETUP</span><h2>Getting KASA ready</h2></div></div>
     <ol className="bootstrap-steps">{(site.bootstrapSteps||defaultSite.bootstrapSteps||[]).map((step,i)=><li key={i}><span>{i+1}</span><p>{step}</p></li>)}</ol>
     <div className="bootstrap-note"><LockKeyhole size={17}/><p>Only the verified email authorized by KASA's server-side setup policy can initialize the first administrator. This screen never reveals that email or Firebase credentials.</p></div>
    </aside>
   </div>
   <p className="bootstrap-footnote">Using a trusted computer? You can also use the <a href="https://github.com/pamtechz/kasa/blob/main/scripts/bootstrap-admin.mjs" target="_blank" rel="noreferrer">official GitHub bootstrap script</a>. Keep Firebase private keys outside the website and repository.</p>
  </main>
 </div>;
}
