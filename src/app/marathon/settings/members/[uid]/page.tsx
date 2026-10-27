'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {ArrowLeft,Save,KeyRound,ShieldCheck} from 'lucide-react';
import {api} from '@/components/Portal';
import {BrandLogo} from '@/components/BrandLogo';

type Account={uid:string;email:string;displayName:string;role:string;active:boolean;
 phone:string;district:string;province:string;address:string;marathonRole:string|null;
 marathonActive:boolean;emailVerified:boolean;mustChangePassword:boolean};
const marathonRoles=['kasaAdmin','kasaOperations','kasaEditor','kasaReviewer','kasaClient'];
export default function MarathonMemberEditor(){
 const {uid}=useParams<{uid:string}>();
 const [account,setAccount]=useState<Account|null>(null);
 const [name,setName]=useState(''),[phone,setPhone]=useState(''),[district,setDistrict]=useState(''),
 [province,setProvince]=useState(''),[address,setAddress]=useState('');
 const [role,setRole]=useState('marathon_only'),[active,setActive]=useState(true),
 [marathonRole,setMarathonRole]=useState('kasaClient'),[marathonActive,setMarathonActive]=useState(true);
 const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[approval,setApproval]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),
 [error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(){
  try{
   const result=await api<{account:Account}>('/api/marathon/members/'+encodeURIComponent(uid)+'/account');
   const a=result.account;
   setAccount(a);setName(a.displayName);setPhone(a.phone||'');setDistrict(a.district||'');
   setProvince(a.province||'');setAddress(a.address||'');setRole(a.role);
   setActive(a.active);setMarathonRole(a.marathonRole||'kasaClient');setMarathonActive(a.marathonActive);
  }catch(e){setError(e instanceof Error?e.message:'Unable to load member.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[uid]); // eslint-disable-line react-hooks/exhaustive-deps
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   const result=await api<{message:string}>('/api/marathon/members/'+encodeURIComponent(uid)+'/account',{
    method:'PATCH',body:JSON.stringify({displayName:name,phone,district,province,address,
     active,schoolRole:role,marathonRole,marathonActive})
   });
   setMessage(result.message);await load();
  }catch(e){setError(e instanceof Error?e.message:'Unable to save account.');}
  finally{setBusy(false);}
 }
 async function setInitialPassword(){
  if(!approval||!password||password!==confirmation)return;
  setBusy(true);setError('');setMessage('');
  try{
   const response=await api<{message:string}>('/api/admin/users/'+encodeURIComponent(uid)+'/initial-password',{
    method:'POST',body:JSON.stringify({confirm:true,password})
   });
   setMessage(response.message);setPassword('');setConfirmation('');setApproval(false);
  }catch(e){setError(e instanceof Error?e.message:'Password could not be set.');}
  finally{setBusy(false);}
 }
 return <main style={{minHeight:'100vh',background:'#f2f7f3',padding:'clamp(16px,4vw,50px)'}}>
  <div style={{maxWidth:1000,margin:'0 auto'}}>
   <header style={{display:'flex',alignItems:'center',gap:16,marginBottom:24}}>
    <BrandLogo size={52}/><div><h1>Marathon member account</h1><p>Global KASA identity and secondary Marathon role management</p></div>
   </header>
   <p><Link className="btn btn-outline" href="/marathon/settings"><ArrowLeft size={17}/> Back to Marathon settings</Link></p>
   {loading&&<p role="status">Loading member account…</p>}
   {error&&<p className="alert-error" role="alert">{error}</p>}
   {message&&<p className="notice" role="status">{message}</p>}
   {account&&<div className="settings-grid" style={{alignItems:'start'}}>
    <section className="panel pad-panel"><h2>Account and workspace roles</h2>
     <p>These settings update the same School profile used by both KASA workspaces. Existing accounts are not duplicated.</p>
     <form onSubmit={e=>void save(e)}>
      <div className="form-grid">
       <div className="field full"><label htmlFor="mem-email">Account email (read-only)</label><input id="mem-email" readOnly value={account.email}/></div>
       <div className="field full"><label htmlFor="mem-name">Full name</label><input id="mem-name" required value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></div>
       <div className="field"><label htmlFor="mem-school">School role</label>
        <select id="mem-school" value={role} onChange={e=>setRole(e.target.value)}>
         <option value="marathon_only" disabled={account.role!=='marathon_only'}>Marathon only</option>
         <option value="agent">Agent</option><option value="reviewer">Reviewer</option><option value="admin">Administrator</option><option value="finance">Finance</option>
        </select></div>
       <div className="field"><label htmlFor="mem-marathon">Marathon role</label><select id="mem-marathon" value={marathonRole} onChange={e=>setMarathonRole(e.target.value)}>
        {marathonRoles.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
       <div className="field"><label htmlFor="mem-phone">Phone</label><input id="mem-phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></div>
       <div className="field"><label htmlFor="mem-district">District</label><input id="mem-district" value={district} onChange={e=>setDistrict(e.target.value)}/></div>
       <div className="field"><label htmlFor="mem-province">Province</label><input id="mem-province" value={province} onChange={e=>setProvince(e.target.value)}/></div>
       <div className="field full"><label htmlFor="mem-address">Address</label><input id="mem-address" value={address} onChange={e=>setAddress(e.target.value)}/></div>
      </div>
      <label className="required-toggle"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Global KASA account active</label>
      <label className="required-toggle"><input type="checkbox" checked={marathonActive} onChange={e=>setMarathonActive(e.target.checked)}/> Marathon access active</label>
      <p className="muted">Email verification: {account.emailVerified?'Verified':'Pending'}. Student accounts are not eligible for Marathon.</p>
      <button type="submit" className="btn btn-primary" disabled={busy||!name.trim()}><Save size={17}/> {busy?'Saving…':'Save account settings'}</button>
     </form>
    </section>
    <aside className="panel pad-panel">
     <h2><ShieldCheck size={19}/> Password and verification</h2>
     <p>Only the global super administrator may set a member&apos;s initial password. Firebase never exposes their existing password.</p>
     <div className="field"><label htmlFor="mem-initial">Initial password (12+ characters)</label><input id="mem-initial" autoComplete="new-password" type="password" value={password} maxLength={128} onChange={e=>setPassword(e.target.value)}/></div>
     <div className="field"><label htmlFor="mem-confirm">Confirm password</label><input id="mem-confirm" autoComplete="new-password" type="password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></div>
     <label className="required-toggle"><input type="checkbox" checked={approval} onChange={e=>setApproval(e.target.checked)}/> Confirm replacing this member&apos;s credentials</label>
     <button type="button" className="btn btn-outline" disabled={busy||password.length<12||password!==confirmation||!approval} onClick={()=>void setInitialPassword()}><KeyRound size={17}/> Set initial password</button>
     <p className="muted">A new initial password permits provisional sign-in for 30 days. The member will be regularly asked to verify their email using the message in their Inbox, Spam or Promotions folder.</p>
    </aside>
   </div>}
  </div>
 </main>;
}
