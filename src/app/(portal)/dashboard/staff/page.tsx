'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Plus,ShieldCheck,Trash2,UserPlus,KeyRound,CheckCircle2} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {ConfirmModal} from '@/components/ConfirmModal';
type Staff={uid:string;email:string;displayName:string;role:'super_admin'|'admin'|'reviewer';active:boolean};
export default function StaffManagement(){
 const [staff,setStaff]=useState<Staff[]>([]),[email,setEmail]=useState(''),[role,setRole]=useState<'admin'|'reviewer'>('reviewer'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [deletingStaff,setDeletingStaff]=useState<Staff|null>(null);
 const [selectedStaffUids,setSelectedStaffUids]=useState<Set<string>>(new Set());
 const [bulkDeleteTarget,setBulkDeleteTarget]=useState<'selected'|'all'|null>(null);

 // User Provisioning States
 const [provEmail,setProvEmail]=useState('');
 const [provName,setProvName]=useState('');
 const [provRole,setProvRole]=useState<'student'|'agent'|'admin'|'reviewer'>('student');
 const [provDistrict,setProvDistrict]=useState('');
 const [provPhone,setProvPhone]=useState('');
 const [provResult,setProvResult]=useState<{email:string;displayName:string;role:string;tempPassword?:string;agentCode?:string}|null>(null);

 const load=async()=>{const r=await api<{staff:Staff[]}>('/api/admin/staff');setStaff(r.staff);};
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);

 async function provisionUser(e: React.FormEvent) {
  e.preventDefault();
  if(!provEmail.trim()||!provName.trim())return;
  setBusy(true);setError('');setNotice('');setProvResult(null);
  try {
   const res = await api<{ok:boolean;email:string;displayName:string;role:string;tempPassword?:string;agentCode?:string;message:string}>('/api/admin/users/provision', {
    method: 'POST',
    body: JSON.stringify({
     email: provEmail,
     displayName: provName,
     role: provRole,
     district: provDistrict,
     phone: provPhone
    })
   });
   setProvResult(res);
   setNotice(res.message);
   setProvEmail(''); setProvName(''); setProvDistrict(''); setProvPhone('');
   await load();
  } catch (err) {
   setError(err instanceof Error ? err.message : 'Provisioning failed.');
  } finally { setBusy(false); }
 }
 async function assign(){
  setBusy(true);setError('');setNotice('');
  try{await api('/api/admin/staff',{method:'POST',body:JSON.stringify({email,role})});setNotice('Approved staff access assigned.');setEmail('');await load();}
  catch(e){setError(e instanceof Error?e.message:'Unable to appoint staff.');}finally{setBusy(false);}
 }
 async function change(member:Staff,data:Record<string,unknown>){
  setError('');try{await api('/api/admin/staff/'+member.uid,{method:'PATCH',body:JSON.stringify(data)});await load();}
  catch(e){setError(e instanceof Error?e.message:'Update failed.');}
 }
 async function confirmRemoveStaff(){
  if(!deletingStaff)return;
  setError('');try{await api('/api/admin/staff/'+deletingStaff.uid,{method:'DELETE'});setNotice(`Removed ${deletingStaff.displayName} from staff.`);setDeletingStaff(null);await load();}
  catch(e){setError(e instanceof Error?e.message:'Remove failed.');}
 }

 const removableStaff = staff.filter(x => x.role !== 'super_admin');
 const allRemovableSelected = removableStaff.length > 0 && removableStaff.every(x => selectedStaffUids.has(x.uid));

 function toggleSelectAllStaff() {
  if (allRemovableSelected) setSelectedStaffUids(new Set());
  else setSelectedStaffUids(new Set(removableStaff.map(x => x.uid)));
 }

 function toggleSelectStaff(uid: string) {
  const next = new Set(selectedStaffUids);
  if (next.has(uid)) next.delete(uid);
  else next.add(uid);
  setSelectedStaffUids(next);
 }

 async function confirmBulkDeleteStaff(){
  if(!bulkDeleteTarget)return;
  setError('');
  try{
   const uidsToDelete = bulkDeleteTarget === 'selected' ? Array.from(selectedStaffUids) : removableStaff.map(x => x.uid);
   for (const uid of uidsToDelete) {
    await api('/api/admin/staff/' + uid, {method: 'DELETE'});
   }
   setNotice(`Successfully removed ${uidsToDelete.length} staff member(s).`);
   setSelectedStaffUids(new Set());
   setBulkDeleteTarget(null);
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Bulk remove failed.');}
 }
 return <><PageHeader title="Staff, Agents & Student Users" subtitle="Provision student and agent accounts directly from the admin portal, assign roles, and manage authorized personnel."/>

 <section className="panel pad-panel" style={{borderLeft:'4px solid var(--green)'}}>
  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
   <UserPlus size={20} style={{color:'var(--green)'}}/>
   <h2 style={{margin:0,fontSize:18}}>Provision New User Account (Student, Agent or Staff)</h2>
  </div>
  <p className="muted" style={{fontSize:13,marginBottom:16}}>
   Directly create a user profile with an auto-generated temporary password. When the user logs in to their portal, they will set their permanent password.
  </p>

  <form onSubmit={e=>void provisionUser(e)}>
   <div className="form-grid" style={{marginBottom:16}}>
    <div className="field"><label>Full Name *</label><input required placeholder="E.g. Natasha Chileshe" value={provName} onChange={e=>setProvName(e.target.value)}/></div>
    <div className="field"><label>Email Address *</label><input required type="email" placeholder="user@example.com" value={provEmail} onChange={e=>setProvEmail(e.target.value)}/></div>
    <div className="field"><label>Portal Role *</label><select value={provRole} onChange={e=>setProvRole(e.target.value as any)}><option value="student">Student (Student Portal)</option><option value="agent">District Agent (Agent Portal)</option><option value="reviewer">Application Reviewer</option><option value="admin">Administrator</option></select></div>
    <div className="field"><label>Assigned District (for Agents)</label><input placeholder="E.g. Lusaka, Chisamba" value={provDistrict} onChange={e=>setProvDistrict(e.target.value)}/></div>
    <div className="field full"><label>Phone Number (optional)</label><input type="tel" placeholder="+260 97X XXX XXX" value={provPhone} onChange={e=>setProvPhone(e.target.value)}/></div>
   </div>
   <button className="btn btn-primary" type="submit" disabled={busy||!provEmail.trim()||!provName.trim()}><UserPlus size={16}/>{busy?'Provisioning…':'Provision Account'}</button>
  </form>

  {provResult && (
   <div style={{background:'#f0f8f3',border:'1px dashed var(--green)',padding:16,borderRadius:12,marginTop:16}}>
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,color:'var(--green)',fontWeight:700}}>
     <CheckCircle2 size={18}/>
     <span>Account Provisioned for {provResult.displayName} ({provResult.role.toUpperCase()})</span>
    </div>
    <div style={{fontSize:13,lineHeight:1.6,color:'var(--ink)'}}>
     Email: <strong>{provResult.email}</strong><br/>
     {provResult.tempPassword && <>Generated Temporary Password: <code style={{background:'#e0f0e6',padding:'2px 6px',borderRadius:4,fontWeight:700,color:'var(--green)'}}>{provResult.tempPassword}</code><br/></>}
     {provResult.agentCode && <>Unique Referral Code: <strong>{provResult.agentCode}</strong><br/></>}
     <small className="muted">The user can now log in at <Link href="/login" style={{textDecoration:'underline',fontWeight:700}}>https://kasaschool.vercel.app/login</Link> and will be guided to set their permanent password.</small>
    </div>
   </div>
  )}

  {error&&<div className="alert-error" style={{marginTop:12}}>{error}</div>}
  {notice&&!provResult&&<div className="notice" style={{marginTop:12}}>{notice}</div>}
 </section>
 <section className="panel"><div className="panel-title" style={{flexWrap:'wrap',gap:12}}><div><h2>Authorized personnel</h2><p>Super-administrator accounts can only be provisioned using the separate controlled bootstrap procedure.</p></div>
 <div style={{display:'flex',gap:8,alignItems:'center',marginLeft:'auto'}}>
  <ShieldCheck/>
  {selectedStaffUids.size > 0 && <button className="btn btn-outline" onClick={() => setBulkDeleteTarget('selected')} style={{fontSize:12,padding:'6px 12px',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',display:'inline-flex',alignItems:'center',gap:6}}><Trash2 size={14}/> Remove Selected ({selectedStaffUids.size})</button>}
  {removableStaff.length > 0 && <button className="btn btn-outline" onClick={() => setBulkDeleteTarget('all')} style={{fontSize:12,padding:'6px 12px',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',display:'inline-flex',alignItems:'center',gap:6}}><Trash2 size={14}/> Remove All Staff ({removableStaff.length})</button>}
 </div></div><div className="table-scroll"><table className="data-table"><thead><tr><th style={{width:40}}><input type="checkbox" checked={allRemovableSelected} onChange={toggleSelectAllStaff} aria-label="Select all staff"/></th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
 {staff.map(x=><tr key={x.uid}><td>{x.role !== 'super_admin' ? <input type="checkbox" checked={selectedStaffUids.has(x.uid)} onChange={() => toggleSelectStaff(x.uid)} aria-label={`Select ${x.displayName}`}/> : null}</td><td><strong>{x.displayName}</strong></td><td>{x.email}</td><td>{x.role.replace('_',' ')}</td><td>{x.active?'Active':'Inactive'}</td><td>{x.role!=='super_admin'?<div style={{display:'flex',gap:8,alignItems:'center'}}><button className="text-link" onClick={()=>void change(x,{active:!x.active})}>{x.active?'Deactivate':'Reactivate'}</button><button className="text-link" onClick={()=>void change(x,{role:x.role==='admin'?'reviewer':'admin'})}>Change role</button><button className="text-link" style={{color:'#ef4444'}} onClick={()=>setDeletingStaff(x)}>Remove</button></div>:'Protected'}</td></tr>)}
 {!staff.length&&<tr><td colSpan={6} className="empty-state">No staff accounts configured.</td></tr>}</tbody></table></div></section>
 <ConfirmModal
  isOpen={Boolean(deletingStaff)}
  title="Remove Staff Member"
  message={`Are you sure you want to remove ${deletingStaff?.displayName} (${deletingStaff?.email}) from staff roles?`}
  kind="danger"
  confirmLabel="Remove Staff"
  cancelLabel="Cancel"
  onConfirm={()=>void confirmRemoveStaff()}
  onCancel={()=>setDeletingStaff(null)}
 />

 <ConfirmModal
  isOpen={Boolean(bulkDeleteTarget)}
  title="Remove Multiple Staff Members"
  message={`Are you sure you want to remove ${bulkDeleteTarget === 'selected' ? `${selectedStaffUids.size} selected` : `all ${removableStaff.length}`} staff member(s)?`}
  kind="danger"
  confirmLabel="Remove Staff"
  cancelLabel="Cancel"
  onConfirm={()=>void confirmBulkDeleteStaff()}
  onCancel={()=>setBulkDeleteTarget(null)}
 />
</>;
}
