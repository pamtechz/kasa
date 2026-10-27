'use client';
import {useEffect,useState} from 'react';
import {onAuthStateChanged,reload,sendEmailVerification} from 'firebase/auth';
import {AlertTriangle,CheckCircle2,Mail,RefreshCcw,X} from 'lucide-react';
import {getClientAuth} from '@/lib/firebase-client';
import {usePathname} from 'next/navigation';
const FOUR_HOURS=4*60*60*1000;
export function EmailVerificationNudge(){
 const pathname=usePathname();
 const [eligible,setEligible]=useState(false),[open,setOpen]=useState(false);
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  const auth=getClientAuth();
  if(!auth)return;
  let mounted=true;
  const check=async()=>{
   const user=auth.currentUser;
   if(!user||user.emailVerified){if(mounted){setEligible(false);setOpen(false);}return;}
   try{
    const token=await user.getIdToken();
    const response=await fetch('/api/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    const data=await response.json();
    if(!mounted)return;
    const permitted=response.ok&&Boolean(data?.profile?.adminPasswordProvisionedAt);
    setEligible(permitted);
    if(permitted){
     const key='kasa:email-nudge:'+user.uid;
     let last=0;try{last=Number(window.localStorage.getItem(key)||0);}catch{}
     if(Date.now()-last>=FOUR_HOURS)setOpen(true);
    }
   }catch{if(mounted)setEligible(false);}
  };
  const unsub=onAuthStateChanged(auth,()=>void check());
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void check();},60*60*1000);
  return()=>{mounted=false;unsub();window.clearInterval(timer);};
 },[]);
 if(!eligible||pathname==='/login'||pathname.startsWith('/apply/'))return null;
 function dismiss(){
  const user=getClientAuth()?.currentUser;
  if(user)try{window.localStorage.setItem('kasa:email-nudge:'+user.uid,String(Date.now()));}catch{}
  setOpen(false);
 }
 async function send(){
  const user=getClientAuth()?.currentUser;if(!user||busy)return;
  setBusy(true);setNotice('');
  try{
   const key='kasa:verification-sent:'+user.uid;
   let last=0;try{last=Number(window.localStorage.getItem(key)||0);}catch{}
   if(Date.now()-last<10*60*1000)throw Error('A verification email was recently requested. Please wait ten minutes before trying again.');
   await sendEmailVerification(user);
   try{window.localStorage.setItem(key,String(Date.now()));}catch{}
   setNotice('Verification email sent. Check Inbox, Spam/Junk and Promotions.');
  }catch(e){setNotice(e instanceof Error?e.message:'Verification email could not be sent.');}
  finally{setBusy(false);}
 }
 async function confirm(){
  const user=getClientAuth()?.currentUser;if(!user||busy)return;
  setBusy(true);setNotice('');
  try{
   await reload(user);await user.getIdToken(true);
   if(user.emailVerified){setEligible(false);setOpen(false);setNotice('Email verified. Thank you.');}
   else setNotice('Still awaiting verification. Open the email link, then return and try again.');
  }catch{setNotice('Could not refresh your verification status. Try again when online.');}
  finally{setBusy(false);}
 }
 return <>
  <div role="status" style={{position:'sticky',top:0,zIndex:1100,background:'#fff6d9',color:'#4a3412',padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',borderBottom:'1px solid #dec88a'}}>
   <span><AlertTriangle size={16} style={{verticalAlign:'middle'}}/> Email not yet verified. You can use your admin-provisioned KASA account temporarily; verify within 30 days.</span>
   <button type="button" onClick={()=>setOpen(true)} style={{textDecoration:'underline'}}>How to verify</button>
  </div>
  {open&&<div style={{position:'fixed',inset:0,zIndex:1250,background:'#071e16aa',display:'grid',placeItems:'center',padding:16}}>
   <section role="dialog" aria-modal="true" aria-labelledby="verify-prompt-title" style={{width:'min(100%,530px)',background:'white',borderRadius:15,padding:24,color:'#153a2b',boxShadow:'0 18px 55px #0003'}}>
    <button type="button" onClick={dismiss} aria-label="Remind me later" style={{float:'right'}}><X size={20}/></button>
    <h2 id="verify-prompt-title"><Mail size={22} style={{verticalAlign:'middle'}}/> Verify your email address</h2>
    <p>You have been allowed to sign in with a super-admin-provided initial password. This does not verify ownership of your email. Please complete verification within 30 days.</p>
    <p><strong>Where to find the message:</strong> Open your email app, check your <strong>Inbox</strong>, then <strong>Spam/Junk</strong> or <strong>Promotions</strong>. Search for <strong>Firebase</strong> or <strong>KASA verification</strong>. Open the verification email and select its verification link.</p>
    <p>If you cannot find it, select <strong>Send verification email</strong> below. After following the link, return here and select <strong>I've verified</strong>.</p>
    {notice&&<p role="status">{notice}</p>}
    <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
     <button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void send()}><Mail size={16}/> Send verification email</button>
     <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void confirm()}><CheckCircle2 size={16}/> I&apos;ve verified</button>
     <button type="button" className="btn btn-outline" disabled={busy} onClick={dismiss}><RefreshCcw size={16}/> Remind me later</button>
    </div>
   </section>
  </div>}
 </>;
}
