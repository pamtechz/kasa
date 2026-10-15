'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {onAuthStateChanged} from 'firebase/auth';
import {auth,appCheckToken,firebaseConfigured} from '@/lib/firebase-client';
import {BrandLogo} from '@/components/BrandLogo';
export default function Bootstrap(){
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{
  if(!firebaseConfigured)return;
  return onAuthStateChanged(auth,user=>setEmail(user?.email||''));
 },[]);
 async function activate(){
  setBusy(true);setMessage('');
  try{
   const user=auth.currentUser;
   if(!user)throw Error('Sign in using the nominated administrator account first.');
   await user.reload();
   if(!user.emailVerified)throw Error('Verify your Firebase Authentication email before proceeding.');
   const token=await user.getIdToken(true);
   const appCheck=await appCheckToken();
   const r=await fetch('/api/bootstrap',{method:'POST',headers:{authorization:'Bearer '+token,...(appCheck?{'X-Firebase-AppCheck':appCheck}:{})}});
   const body=await r.json();if(!r.ok)throw Error(body.error||'Bootstrap failed.');
   setMessage('Administrator access initialized. Open the dashboard to configure KASA.');
  }catch(e){setMessage(e instanceof Error?e.message:'Bootstrap failed.');}
  finally{setBusy(false);}
 }
 return <div className="public-root"><main className="container section-pad"><div className="page-heading"><BrandLogo size={80}/><h1>First administrator setup</h1></div>
 <p>This is a one-time security-controlled setup, not a public administrator registration page. Only the exact email configured as <code>BOOTSTRAP_ADMIN_EMAIL</code> in Vercel, with a verified Firebase Authentication address, may initialize KASA.</p>
 <ol><li>Configure Firebase Authentication (email/password and authorized domain).</li><li>Create your own account at <Link href="/login">Staff registration and login</Link>, then verify the email.</li><li>Sign in, return here and select the secure activation button.</li><li>Open the dashboard, seed the catalogue, review forms and configure the admission window before admitting applicants.</li></ol>
 <p>Signed-in email: <strong>{email||'Not signed in'}</strong></p>
 <div className="inline-form"><button className="btn btn-primary" disabled={busy||!email} onClick={()=>void activate()}>{busy?'Verifying…':'Initialize my KASA administrator account'}</button><Link className="btn btn-outline" href="/dashboard">Open dashboard</Link></div>
 {message&&<p role="status" className="notice">{message}</p>}
 <p><small>Alternative command-line bootstrap: <a href="https://github.com/pamtechz/kasa/blob/main/scripts/bootstrap-admin.mjs" target="_blank" rel="noreferrer">GitHub bootstrap script</a>. Never submit your Firebase private key through the website.</small></p>
 </main></div>;
}
