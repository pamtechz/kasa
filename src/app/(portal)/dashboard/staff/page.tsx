'use client';
import {useEffect,useState} from 'react';
import {Plus,ShieldCheck} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
type Staff={uid:string;email:string;displayName:string;role:'super_admin'|'admin'|'reviewer';active:boolean};
export default function StaffManagement(){
 const [staff,setStaff]=useState<Staff[]>([]),[email,setEmail]=useState(''),[role,setRole]=useState<'admin'|'reviewer'>('reviewer'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{const r=await api<{staff:Staff[]}>('/api/admin/staff');setStaff(r.staff);};
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
 async function assign(){
  setBusy(true);setError('');setNotice('');
  try{await api('/api/admin/staff',{method:'POST',body:JSON.stringify({email,role})});setNotice('Approved staff access assigned.');setEmail('');await load();}
  catch(e){setError(e instanceof Error?e.message:'Unable to appoint staff.');}finally{setBusy(false);}
 }
 async function change(member:Staff,data:Record<string,unknown>){
  setError('');try{await api('/api/admin/staff/'+member.uid,{method:'PATCH',body:JSON.stringify(data)});await load();}
  catch(e){setError(e instanceof Error?e.message:'Update failed.');}
 }
 return <><PageHeader title="Staff and reviewers" subtitle="Approve access, assign reviewers and manage operational staff without creating unverified accounts."/>
 <section className="panel pad-panel"><h2>Assign staff access</h2><p className="muted">The user must register with Firebase Authentication and verify their email. Only a super administrator can appoint or deactivate staff.</p>
 <div className="inline-form"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Verified staff email"/><select value={role} onChange={e=>setRole(e.target.value as 'admin'|'reviewer')}><option value="reviewer">Application reviewer</option><option value="admin">Administrator</option></select><button className="btn btn-primary" disabled={busy||!email} onClick={()=>void assign()}><Plus size={16}/>Assign role</button></div>
 {error&&<div className="alert-error">{error}</div>}{notice&&<div className="notice">{notice}</div>}</section>
 <section className="panel"><div className="panel-title"><div><h2>Authorized personnel</h2><p>Super-administrator accounts can only be provisioned using the separate controlled bootstrap procedure.</p></div><ShieldCheck/></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
 {staff.map(x=><tr key={x.uid}><td><strong>{x.displayName}</strong></td><td>{x.email}</td><td>{x.role.replace('_',' ')}</td><td>{x.active?'Active':'Inactive'}</td><td>{x.role!=='super_admin'?<><button className="text-link" onClick={()=>void change(x,{active:!x.active})}>{x.active?'Deactivate':'Reactivate'}</button><button className="text-link" onClick={()=>void change(x,{role:x.role==='admin'?'reviewer':'admin'})}>Change role</button></>:'Protected'}</td></tr>)}
 {!staff.length&&<tr><td colSpan={5} className="empty-state">No staff accounts configured.</td></tr>}</tbody></table></div></section></>;
}
