'use client';
import {useState} from 'react';
import {createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signInWithEmailAndPassword,updateProfile,signOut} from 'firebase/auth';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {auth,firebaseConfigured} from '@/lib/firebase-client';
import {ArrowRight,LockKeyhole} from 'lucide-react';
import {BrandLogo} from '@/components/BrandLogo';
export default function Login(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[mode,setMode]=useState<'sign-in'|'register'>('sign-in'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const router=useRouter();
 async function go(e:React.FormEvent){e.preventDefault();setMessage('');setBusy(true);try{
  if(mode==='register'){
   const cred=await createUserWithEmailAndPassword(auth,email,password);
   await updateProfile(cred.user,{displayName:name});
   await sendEmailVerification(cred.user);
   await signOut(auth);
   setMessage('Account created. Check your email to verify the address. KASA must also approve your agent or staff access.');
   setMode('sign-in');
  }else{
   const credential=await signInWithEmailAndPassword(auth,email,password);
   await credential.user.reload();
   if(!credential.user.emailVerified){await sendEmailVerification(credential.user);await signOut(auth);throw Error('Please verify your email address before signing in. A new verification email has been sent.');}
   const token=await auth.currentUser?.getIdToken(true);
   const resp=await fetch('/api/me',{headers:{Authorization:`Bearer ${token}`}});
   const data=await resp.json();if(!resp.ok)throw Error(data.error||'No approved account found.');
   router.push('/dashboard');
  }
 }catch(e){setMessage(e instanceof Error?e.message:'Unable to sign in.');}finally{setBusy(false);}}
 async function reset(){if(!email){setMessage('Enter your email address first.');return;}try{await sendPasswordResetEmail(auth,email);setMessage('If this email is registered, password reset instructions will be sent.');}catch{setMessage('Unable to send password reset.');}}
 if(!firebaseConfigured)return <main className="login-shell"><div className="login-form"><div className="login-card"><BrandLogo size={72}/><h2>Enrollment portal setup</h2><p>Authentication will be available after KASA connects its Firebase project. No applications can be processed until setup is complete.</p><Link href="/" className="back-link">← Return to KASA</Link></div></div></main>;
 return <main className="login-shell"><div className="login-art"><Link href="/" className="brand brand-white"><BrandLogo size={62}/><span><strong>KASA</strong><small>Enrollment Network</small></span></Link><div><span className="overline">SECURE WORKSPACE</span><h1>Everything your district needs. One place.</h1><p>Manage applications, monitor enrollment outcomes and coordinate with the KASA admissions team.</p></div><span className="login-art-bottom">Authorized agents and personnel only.</span></div><div className="login-form"><div className="login-card"><span className="login-symbol"><LockKeyhole/></span><h2>{mode==='sign-in'?'Welcome back':'Create an account'}</h2><p>Use your KASA-associated email address.</p><form onSubmit={e=>void go(e)}>{mode==='register'&&<div className="field"><label>Full name</label><input value={name} onChange={e=>setName(e.target.value)} required/></div>}<div className="field"><label>Email address</label><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div><div className="field"><label>Password</label><input type="password" autoComplete={mode==='sign-in'?'current-password':'new-password'} minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></div>{message&&<div className="notice">{message}</div>}<button className="btn btn-primary btn-full" disabled={busy}>{busy?'Please wait…':mode==='sign-in'?'Sign in':'Create account'} <ArrowRight size={16}/></button></form><div className="auth-bottom"><button onClick={()=>{setMode(mode==='sign-in'?'register':'sign-in');setMessage('');}}>{mode==='sign-in'?'Need an account? Register':'Already registered? Sign in'}</button>{mode==='sign-in'&&<button onClick={()=>void reset()}>Forgot password?</button>}</div><Link href="/" className="back-link">← Return to KASA website</Link></div></div></main>;
}
