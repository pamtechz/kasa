'use client';
import {useState} from 'react';
import {createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signInWithEmailAndPassword,updateProfile,signOut} from 'firebase/auth';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {auth,firebaseConfigured,requireClientAuth} from '@/lib/firebase-client';
import {ArrowRight,LockKeyhole} from 'lucide-react';
import {BrandLogo} from '@/components/BrandLogo';
function readableAuthError(error:unknown):string{
 const code=error&&typeof error==='object'&&'code' in error?String((error as {code?:unknown}).code||''):'';
 if(['auth/invalid-credential','auth/wrong-password','auth/user-not-found','auth/invalid-email'].includes(code))return 'Incorrect email or password. Check your details and try again.';
 if(code==='auth/network-request-failed')return 'Unable to reach Firebase Authentication. Check your internet connection.';
 if(code==='auth/too-many-requests')return 'Too many attempts. Wait a few minutes before retrying.';
 if(code==='auth/email-already-in-use')return 'This email is already registered. Please sign in.';
 if(code==='auth/weak-password')return 'Choose a stronger password with at least 8 characters.';
 return error instanceof Error?error.message:'Authentication failed. Please try again.';
}
export default function Login(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[mode,setMode]=useState<'sign-in'|'register'>('sign-in'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const router=useRouter();
 async function go(e:React.FormEvent){e.preventDefault();setMessage('');setBusy(true);try{
  const firebaseAuth=requireClientAuth();
  if(mode==='register'){
   const cred=await createUserWithEmailAndPassword(firebaseAuth,email.trim().toLowerCase(),password);
   await updateProfile(cred.user,{displayName:name});
   await sendEmailVerification(cred.user);
   await signOut(firebaseAuth);
   setMessage('Account created. Verify your email to view student applications. Agent and staff access require KASA approval.');
   setMode('sign-in');
  }else{
   const credential=await signInWithEmailAndPassword(firebaseAuth,email.trim().toLowerCase(),password);
   await credential.user.reload();
   if(!credential.user.emailVerified){await sendEmailVerification(credential.user);await signOut(firebaseAuth);throw Error('Please verify your email address before signing in. A new verification email has been sent.');}
   // Returning to the bootstrap page never grants a role; the bootstrap API enforces the nominated email.
   const requested=new URLSearchParams(window.location.search).get('next');
   if(requested==='/bootstrap'){router.replace('/bootstrap');return;}
   if(requested==='/my-applications'){router.replace('/my-applications');return;}
   const token=await firebaseAuth.currentUser?.getIdToken(true);
   const resp=await fetch('/api/me',{headers:{Authorization:`Bearer ${token}`}});
   const data=await resp.json().catch(()=>({error:'Account verification service is temporarily unavailable.'}));if(resp.ok)router.replace('/dashboard');
   else if(resp.status===403)router.replace('/my-applications');
   else throw Error(data.error||'Unable to check your account role.');
  }
 }catch(e){setMessage(readableAuthError(e));}finally{setBusy(false);}}
 async function reset(){if(!email.trim()){setMessage('Enter your email address first.');return;}try{await sendPasswordResetEmail(requireClientAuth(),email.trim().toLowerCase());setMessage('If this email is registered, password reset instructions will be sent.');}catch{setMessage('Unable to send password reset.');}}
 if(!firebaseConfigured)return <main className="login-shell"><div className="login-form"><div className="login-card"><BrandLogo size={72}/><h2>Enrollment portal setup</h2><p>Authentication will be available after KASA connects its Firebase project. No applications can be processed until setup is complete.</p><Link href="/" className="back-link">← Return to KASA</Link></div></div></main>;
 return <main className="login-shell"><div className="login-art"><Link href="/" className="brand brand-white"><BrandLogo size={62}/><span><strong>KASA</strong><small>Enrollment Network</small></span></Link><div><span className="overline">SECURE WORKSPACE</span><h1>Everything your district needs. One place.</h1><p>Manage applications, monitor enrollment outcomes and coordinate with the KASA admissions team.</p></div><span className="login-art-bottom">Students may view their own applications; staff and agents receive separate approved access.</span></div><div className="login-form"><div className="login-card"><span className="login-symbol"><LockKeyhole/></span><h2>{mode==='sign-in'?'Welcome back':'Create an account'}</h2><p>Use your KASA-associated email address.</p><form onSubmit={e=>void go(e)}>{mode==='register'&&<div className="field"><label>Full name</label><input value={name} onChange={e=>setName(e.target.value)} required/></div>}<div className="field"><label>Email address</label><input type="email" name="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div><div className="field"><label>Password</label><input type="password" name="password" autoComplete={mode==='sign-in'?'current-password':'new-password'} minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></div>{message&&<div className="notice" role="alert">{message}</div>}<button className="btn btn-primary btn-full" disabled={busy}>{busy?'Please wait…':mode==='sign-in'?'Sign in':'Create account'} <ArrowRight size={16}/></button></form><div className="auth-bottom"><button onClick={()=>{setMode(mode==='sign-in'?'register':'sign-in');setMessage('');}}>{mode==='sign-in'?'Need an account? Register':'Already registered? Sign in'}</button>{mode==='sign-in'&&<button onClick={()=>void reset()}>Forgot password?</button>}</div><Link href="/bootstrap" className="back-link">First administrator setup</Link><Link href="/my-applications" className="back-link">View my student applications</Link><Link href="/" className="back-link">← Return to KASA website</Link></div></div></main>;
}
