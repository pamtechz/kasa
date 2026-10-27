'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {ArrowLeft,Save,ShieldCheck,Mail,KeyRound,AlertTriangle} from 'lucide-react';
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
 const [active,setActive]=useState(true),[mustChange,setMustChange]=useState(false);
 const [busy,setBusy]=useState(false),[resetBusy,setResetBusy]=useState(false),[loading,setLoading]=useState(true);
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
   setActive(x.active!==false);setMustChange(Boolean(x.mustChangePassword));
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
    payload.mustChangePassword=mustChange;
   }
   await api('/api/admin/users/'+encodeURIComponent(uid),{method:'PATCH',body:JSON.stringify(payload)});
   setMessage('Account changes saved successfully.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Unable to update account.');}
  finally{setBusy(false);}
 }
 async function sendReset(){
  if(actorRole!=='super_admin'||!account||!confirmedReset||uid===account.uid&&account.role==='super_admin')return;
  setResetBusy(true);setError('');setMessage('');
  try{
   const result=await api<{message:string}>('/api/admin/users/'+encodeURIComponent(uid)+'/password-reset',{
    method:'POST',body:JSON.stringify({confirm:true})
   });
   setMessage(result.message);setConfirmedReset(false);
  }catch(e){setError(e instanceof Error?e.message:'Password reset email was not sent.');}
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
     {actorRole==='super_admin'&&<div className="field"><label className="required-toggle">
      <input type="checkbox" checked={mustChange} onChange={e=>setMustChange(e.target.checked)}/> Require password change</label></div>}
     <button className="btn btn-primary" type="submit" disabled={busy||!name.trim()}><Save size={16}/> {busy?'Saving…':'Save account'}</button>
    </form>
   </section>
   <aside className="panel pad-panel">
    <h2><ShieldCheck size={18}/> Identity and recovery</h2>
    <p>Existing passwords cannot be viewed. Password recovery uses Firebase's verified email recovery process.</p>
    {actorRole==='super_admin'&&account.role!=='super_admin'?<>
     <h3><KeyRound size={17}/> Reset this user&apos;s password</h3>
     <p className="muted">Only a super administrator may request recovery for another user. The reset link goes directly to the registered account email; it is never displayed to an administrator. Requests have a 15-minute cooldown and are audited.</p>
     <p><Mail size={15}/> {account.email}</p>
     <label className="required-toggle"><input type="checkbox" checked={confirmedReset} onChange={e=>setConfirmedReset(e.target.checked)}/>
      I confirm that I intend to send password recovery instructions to this account owner.</label>
     <button type="button" className="btn btn-outline" disabled={!confirmedReset||resetBusy} onClick={()=>void sendReset()}>
      <KeyRound size={16}/> {resetBusy?'Requesting…':'Send password reset email'}
     </button>
    </>:<p className="muted"><AlertTriangle size={16}/> Only the global super administrator may initiate another user&apos;s password recovery.</p>}
   </aside>
  </div>}
 </div>;
}
