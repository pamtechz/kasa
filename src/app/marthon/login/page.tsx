'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {onAuthStateChanged,sendEmailVerification,sendPasswordResetEmail,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {ArrowRight,ArrowLeft,ShieldCheck,CalendarDays,LockKeyhole,Eye,EyeOff} from 'lucide-react';
import {firebaseConfigured,requireClientAuth} from '@/lib/firebase-client';

function readableSignInError(error:unknown):string{
 const code=error&&typeof error==='object'&&'code' in error?String((error as {code?:unknown}).code||''):'';
 if(['auth/invalid-credential','auth/wrong-password','auth/user-not-found','auth/invalid-email'].includes(code))
  return 'KASA School did not accept that email/password combination. Use the same credentials as the main school portal, or select Forgot password below. No separate Marathon account is needed.';
 if(code==='auth/operation-not-allowed')
  return 'Email/password sign-in is not enabled for this Firebase project. Contact the KASA School super administrator.';
 if(['auth/invalid-api-key','auth/app-not-authorized','auth/unauthorized-domain'].includes(code))
  return 'The deployed Firebase sign-in configuration needs administrator attention. Please contact KASA School support.';
 if(code==='auth/network-request-failed')return 'Firebase Authentication could not be reached. Check your connection and try again.';
 if(code==='auth/too-many-requests')return 'Too many sign-in attempts. Please wait before trying again, or use password recovery.';
 if(code==='auth/user-disabled')return 'This school account has been disabled. Contact the KASA School administrator.';
 return error instanceof Error?error.message:'Unable to sign in with your KASA School account.';
}

export default function MarathonLogin(){
 const router=useRouter();const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[show,setShow]=useState(false);
 useEffect(()=>{if(!firebaseConfigured)return;const a=requireClientAuth();return onAuthStateChanged(a,async user=>{
  if(!user?.emailVerified)return;
  try{
   const result=await fetch('/api/marathon/bootstrap',{cache:'no-store',headers:{Authorization:'Bearer '+await user.getIdToken()}});
   if(result.ok)router.replace('/marthon');
  }catch{/* Keep sign-in available if access cannot be verified. */}
 });},[router]);
 async function login(event:React.FormEvent){
  event.preventDefault();setBusy(true);setError('');
  try{
   const a=requireClientAuth();
   const result=await signInWithEmailAndPassword(a,email.trim().toLowerCase(),password);
   await result.user.reload();
   if(!result.user.emailVerified){
    let verificationSent=false;
    try{await sendEmailVerification(result.user);verificationSent=true;}catch{/* Firebase can rate-limit repeated requests. */}
    await signOut(a);
    throw Error(verificationSent
      ?'Please verify your KASA School email before signing in. A verification email has been requested; check your inbox and spam folder.'
      :'Your KASA School account is waiting for email verification. Use the main School login to request a new verification email.');
   }
   const res=await fetch('/api/marathon/bootstrap',{headers:{Authorization:'Bearer '+await result.user.getIdToken()},cache:'no-store'});
   if(!res.ok){const data=await res.json().catch(()=>({}));throw Error(data.error||'You do not have Marathon workspace access yet.');}
   router.replace('/marthon');
  }catch(e){setError(readableSignInError(e));}finally{setBusy(false);}
 }
 async function reset(){if(!email.trim()){setError('Enter your KASA School email address first.');return;}
  try{await sendPasswordResetEmail(requireClientAuth(),email.trim().toLowerCase());setError('If that address has a KASA School password account, Firebase will send recovery instructions. Check your inbox and spam folder.');}
  catch{setError('Unable to request a password reset.');}
 }
 return <main className="ml-login">
  <section className="ml-login-art">
   <div className="ml-login-brand"><span className="ml-mark">K</span><span>KASA <b>LIFE</b><small>MARATHON COMMAND CENTRE</small></span></div>
   <div className="ml-login-graphic"><div className="ml-orbit ml-orbit-one"/><div className="ml-orbit ml-orbit-two"/><span>21<span className="ml-orbit-dot">●</span></span><small>MAR 2027</small></div>
   <div className="ml-login-bottom"><span className="ml-eyebrow">ONE EVENT. ONE MISSION.</span><h1>Every detail.<br/>One clear view.</h1><p>Plan confidently, collaborate across teams and monitor every milestone on the road to race day.</p><div className="ml-login-tags"><span>21.1 KM</span><span>10 KM</span><span>5 KM</span></div></div>
  </section>
  <section className="ml-login-main"><div className="ml-login-top"><Link href="/" className="ml-back"><ArrowLeft size={17}/> Main KASA website</Link><span className="ml-login-sec"><ShieldCheck size={16}/> Protected workspace</span></div>
   <div className="ml-login-formwrap"><div className="ml-login-icon"><LockKeyhole size={24}/></div><span className="ml-eyebrow">WELCOME BACK</span><h2>Sign in to the<br/>Marathon workspace</h2><p>Use your existing KASA School email and password. Only the school super administrator can enable your additional Marathon role from Marathon settings.</p>
    <form onSubmit={login} className="ml-login-fields"><label>Email address<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@organisation.com" required/></label>
     <label>Password<div className="ml-password"><input type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" required/><button type="button" onClick={()=>setShow(!show)} aria-label={show?'Hide password':'Show password'}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
     {error&&<div className="ml-form-error" role="alert">{error}</div>}
     <button disabled={busy||!firebaseConfigured} className="ml-login-submit">{busy?'Signing in…':'Sign in to workspace'}<ArrowRight size={18}/></button>
    </form><button type="button" className="ml-textbtn" onClick={reset}>Forgot password?</button><Link href="/login?next=%2Fmarthon" className="ml-back" style={{fontSize:12}}>Prefer the main KASA School sign-in? Use the same account here</Link>
    <Link href="/login" className="ml-back" style={{fontSize:12}}>Need an account? Register with KASA School</Link>
    {!firebaseConfigured&&<p role="alert">The KASA School Firebase web configuration is not available in this deployment. Contact the administrator.</p>}
    <div className="ml-login-note"><CalendarDays size={17}/> Sunday, 21 March 2027 · KASA Life Marathon</div>
   </div>
   <footer className="ml-login-footer">KASA Life Marathon · Restricted operations portal</footer>
  </section>
 </main>;
}
