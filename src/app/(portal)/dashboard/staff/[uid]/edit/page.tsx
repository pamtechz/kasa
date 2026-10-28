'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {ArrowLeft,Save,ShieldCheck,KeyRound,AlertTriangle} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';

type Account={uid:string;displayName:string;email:string;role:string;active:boolean;
 district:string;phone:string;province:string;mustChangePassword:boolean};
type EditableRole='student'|'agent'|'admin'|'reviewer';
export default function EditSchoolAccount(){
 const params=useParams<{uid:string}>(),uid=params.uid;
 const [account,setAccount]=useState<Account|null>(null);
 const [actorRole,setActorRole]=useState('');
 const [name,setName]=useState(''),[role,setRole]=useState<EditableRole>('student');
 const [district,setDistrict]=useState(''),[phone,setPhone]=useState(''),[province,setProvince]=useState('');
 const [active,setActive]=useState(true);
 const [busy,setBusy]=useState(false),[resetBusy,setResetBusy]=useState(false),[loading,setLoading]=useState(true);
 const [initialPassword,setInitialPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState('');
 const [confirmedReset,setConfirmedReset]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const [u,me]=await Promise.all([
    api<{user:Account}>('/api/admin/users/'+encodeURIComponent(uid)),
    api<{profile:{role:string}}>('/api/me')
   ]);
   const x=u.user;setAccount(x);setName(x.displayName||'');
   setRole(['student','agent','admin','reviewer'].includes(x.role)?x.role as EditableRole:'student');
   setDistrict(x.district||'');setPhone(x.phone||'');setProvince(x.province||'');
   setActive(x.active!==false);
   setActorRole(me.profile.role);
  }catch(e){setError(e instanceof Error?e.message:'Unable to open account.');}
  finally{setLoading(false);}
 },[uid]);
 useEffect(()=>{void load();},[load]);
 async function save(event:React.FormEvent){
  event.preventDefault();if(!account)return;
  setBusy(true);setError('');setMessage('');
  try{
   const payload:Record<string,unknown>={displayName:name,district,phone,province,active};
   if(actorRole==='super_admin'){
    if(account.role!=='super_admin')payload.role=role;
   }
   await api('/api/admin/users/'+encodeURIComponent(uid),{method:'PATCH',body:JSON.stringify(payload)});
   setMessage('Account changes saved successfully.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Unable to update account.');}
  finally{setBusy(false);}
 }
 async function setPassword(){
  if(actorRole!=='super_admin'||!account||!confirmedReset||!initialPassword||initialPassword!==confirmPassword)return;
  setResetBusy(true);setError('');setMessage('');
  try{
   const result=await api<{message:string}>('/api/admin/users/'+encodeURIComponent(uid)+'/initial-password',{
    method:'POST',body:JSON.stringify({confirm:true,password:initialPassword})
   });
   setMessage(result.message);setConfirmedReset(false);setInitialPassword('');setConfirmPassword('');
  }catch(e){setError(e instanceof Error?e.message:'Unable to set initial password.');}
  finally{setResetBusy(false);}
 }

 return <div>
  <PageHeader title="Edit user account" subtitle="Dedicated School account editor with controlled access and verified identity."/>
  <p><Link className="btn btn-outline" href="/dashboard/staff"><ArrowLeft size={16}/> Back to user directory</Link></p>
  {loading&&<p role="status">Loading account…</p>}
  {error&&<div role="alert" className="alert-error" style={{marginBottom:16}}>{error}</div>}
  {message&&<div role="status" className="notice" style={{marginBottom:16}}>{message}</div>}
  {account&&<div className="settings-grid" style={{alignItems:'start'}}>
   <section className="panel pad-panel">
    <h2>Account profile</h2>
    <p className="muted">The verified email is read-only. Role and sensitive account security changes are restricted to super administrators.</p>
    <form onSubmit={e=>void save(e)}>
     <div className="form-grid">
      <div className="field full"><label htmlFor="edit-account-name">Full name *</label>
       <input id="edit-account-name" required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></div>
      <div className="field full"><label htmlFor="edit-account-email">Verified email</label>
       <input id="edit-account-email" type="email" readOnly value={account.email}/></div>
      <div className="field"><label htmlFor="edit-account-role">School role</label>
       <select id="edit-account-role" disabled={actorRole!=='super_admin'||account.role==='super_admin'} value={role} onChange={e=>setRole(e.target.value as EditableRole)}>
        <option value="student">Student</option><option value="agent">District agent</option>
        <option value="reviewer">Reviewer</option><option value="admin">Administrator</option>
       </select></div>
      <div className="field"><label htmlFor="edit-account-district">District</label>
       <input id="edit-account-district" value={district} onChange={e=>setDistrict(e.target.value)}/></div>
      <div className="field"><label htmlFor="edit-account-province">Province</label>
       <input id="edit-account-province" value={province} onChange={e=>setProvince(e.target.value)}/></div>
      <div className="field"><label htmlFor="edit-account-phone">Phone number</label>
       <input id="edit-account-phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></div>
     </div>
     <div className="field"><label className="required-toggle"><input type="checkbox" checked={active} disabled={account.role==='super_admin'} onChange={e=>setActive(e.target.checked)}/> Account active</label></div>
     <button className="btn btn-primary" type="submit" disabled={busy||!name.trim()}><Save size={16}/> {busy?'Saving…':'Save account'}</button>
    </form>
   </section>
   <aside className="panel pad-panel">
    <h2><ShieldCheck size={18}/> Identity and recovery</h2>
    <p>Existing passwords cannot be viewed. Only the global super administrator may set a new initial password. This changes the Firebase Auth password; it is not a recovery email.</p>
    {actorRole==='super_admin'&&account.role!=='super_admin'?<>
     <h3><KeyRound size={17}/> Set initial password</h3>
     <p className="muted">Choose a unique 12–128 character password containing uppercase, lowercase, a number and a symbol. Share it privately. The user can sign in without email verification for up to 30 days and will receive regular reminders to verify. Previously issued credentials will stop working.</p>
     <div className="field"><label htmlFor="initial-password">Initial password</label>
      <input id="initial-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={initialPassword} onChange={e=>setInitialPassword(e.target.value)}/></div>
     <div className="field"><label htmlFor="initial-password-confirm">Confirm initial password</label>
      <input id="initial-password-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></div>
     <label className="required-toggle"><input type="checkbox" checked={confirmedReset} onChange={e=>setConfirmedReset(e.target.checked)}/>
      I confirm that I am authorized to replace this user&apos;s sign-in password.</label>
     <button type="button" className="btn btn-outline" disabled={!confirmedReset||resetBusy||initialPassword!==confirmPassword||initialPassword.length<12} onClick={()=>void setPassword()}>
      <KeyRound size={16}/> {resetBusy?'Saving…':'Set initial password'}
     </button>
    </>:<p className="muted"><AlertTriangle size={16}/> Only the global super administrator may provision another account&apos;s password.</p>}
   </aside>
  </div>}
 </div>;
}
