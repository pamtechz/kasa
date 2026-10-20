'use client';
import {useEffect,useState} from 'react';
import {Plus,ShieldCheck,Trash2} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {ConfirmModal} from '@/components/ConfirmModal';
type Staff={uid:string;email:string;displayName:string;role:'super_admin'|'admin'|'reviewer';active:boolean};
export default function StaffManagement(){
 const [staff,setStaff]=useState<Staff[]>([]),[email,setEmail]=useState(''),[role,setRole]=useState<'admin'|'reviewer'>('reviewer'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [deletingStaff,setDeletingStaff]=useState<Staff|null>(null);
 const [selectedStaffUids,setSelectedStaffUids]=useState<Set<string>>(new Set());
 const [bulkDeleteTarget,setBulkDeleteTarget]=useState<'selected'|'all'|null>(null);
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
 return <><PageHeader title="Staff and reviewers" subtitle="Approve access, assign reviewers and manage operational staff without creating unverified accounts."/>
 <section className="panel pad-panel"><h2>Assign staff access</h2><p className="muted">The user must register with Firebase Authentication and verify their email. Only a super administrator can appoint or deactivate staff.</p>
 <div className="inline-form"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Verified staff email"/><select value={role} onChange={e=>setRole(e.target.value as 'admin'|'reviewer')}><option value="reviewer">Application reviewer</option><option value="admin">Administrator</option></select><button className="btn btn-primary" disabled={busy||!email} onClick={()=>void assign()}><Plus size={16}/>Assign role</button></div>
 {error&&<div className="alert-error">{error}</div>}{notice&&<div className="notice">{notice}</div>}</section>
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
