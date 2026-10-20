'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Banknote,Clock,CheckCircle2,ExternalLink,Plus,Trash2,X,Save} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {ConfirmModal} from '@/components/ConfirmModal';

type Commission={submissionId:string;reference:string;agentId:string;trigger:string;amount:number;currency:string;paidAt:string|null;paymentReference:string|null;fundingEvidence:string|null};
type Totals={eligible:number;paid:number;pending:number};

export default function Commissions(){
 const [items,setItems]=useState<Commission[]>([]),[totals,setTotals]=useState<Totals>({eligible:0,paid:0,pending:0}),[error,setError]=useState(''),[notice,setNotice]=useState(''),[filter,setFilter]=useState('all'),[busy,setBusy]=useState(false);
 const [editing,setEditing]=useState<Commission|null>(null);
 const [deletingCommission,setDeletingCommission]=useState<Commission|null>(null);
 const [selectedSubIds,setSelectedSubIds]=useState<Set<string>>(new Set());
 const [bulkDeleteTarget,setBulkDeleteTarget]=useState<'selected'|'all'|null>(null);
 const [paymentRef,setPaymentRef]=useState('');
 const [payAmount,setPayAmount]=useState('');
 const [creating,setCreating]=useState(false);
 const [newSubId,setNewSubId]=useState('');
 const [newAgentId,setNewAgentId]=useState('');
 const [newAmount,setNewAmount]=useState('300');

 const load=async()=>{
  try{
   const r=await api<{commissions:Commission[];totals:Totals}>('/api/admin/commissions');
   setItems(r.commissions);
   setTotals(r.totals);
  }catch(e){setError(e instanceof Error?e.message:'Unable to load commissions.');}
 };

 useEffect(()=>{void load();},[]);

 const filtered=items.filter(x=>filter==='all'||(filter==='paid'?Boolean(x.paidAt):!x.paidAt));

 async function savePayment(e:React.FormEvent){
  e.preventDefault();
  if(!editing)return;
  setBusy(true);setError('');setNotice('');
  try{
   await api('/api/admin/commissions',{
    method:'PATCH',
    body:JSON.stringify({
     submissionId:editing.submissionId,
     paymentReference:paymentRef,
     amount:Number(payAmount)||editing.amount,
     paid:true
    })
   });
   setNotice(`Commission marked paid for ${editing.reference}`);
   setEditing(null);
   await load();
  }catch(err){setError(err instanceof Error?err.message:'Payment recording failed.');}
  finally{setBusy(false);}
 }

 async function confirmDeleteCommission(){
  if(!deletingCommission)return;
  setBusy(true);setError('');setNotice('');
  try{
   await api(`/api/admin/commissions?submissionId=${deletingCommission.submissionId}`,{method:'DELETE'});
   setNotice(`Commission for ${deletingCommission.reference} voided.`);
   setDeletingCommission(null);
   await load();
  }catch(err){setError(err instanceof Error?err.message:'Unable to void commission.');}
  finally{setBusy(false);}
 }

 async function confirmBulkDeleteCommissions(){
  if(!bulkDeleteTarget)return;
  setBusy(true);setError('');setNotice('');
  try{
   const idsToDelete = bulkDeleteTarget === 'selected' ? Array.from(selectedSubIds) : filtered.map(x => x.submissionId);
   for (const id of idsToDelete) {
    await api(`/api/admin/commissions?submissionId=${id}`,{method:'DELETE'});
   }
   setNotice(`Successfully voided ${idsToDelete.length} commission record(s).`);
   setSelectedSubIds(new Set());
   setBulkDeleteTarget(null);
   await load();
  }catch(err){setError(err instanceof Error?err.message:'Bulk void failed.');}
  finally{setBusy(false);}
 }

 const allCommissionsSelected = filtered.length > 0 && filtered.every(x => selectedSubIds.has(x.submissionId));

 function toggleSelectAllCommissions() {
  if (allCommissionsSelected) setSelectedSubIds(new Set());
  else setSelectedSubIds(new Set(filtered.map(x => x.submissionId)));
 }

 function toggleSelectCommission(id: string) {
  const next = new Set(selectedSubIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  setSelectedSubIds(next);
 }

 async function createManualCommission(e:React.FormEvent){
  e.preventDefault();
  if(!newSubId.trim()||!newAgentId.trim())return;
  setBusy(true);setError('');setNotice('');
  try{
   await api('/api/admin/commissions',{
    method:'POST',
    body:JSON.stringify({submissionId:newSubId,agentId:newAgentId,amount:Number(newAmount)||300})
   });
   setNotice('Manual commission assigned.');
   setCreating(false);
   setNewSubId('');setNewAgentId('');
   await load();
  }catch(err){setError(err instanceof Error?err.message:'Failed to create commission.');}
  finally{setBusy(false);}
 }

 return <><PageHeader title="Commissions and referrals" subtitle="Control awards for independently verified CDF approvals or paid student enrollments." action={<div style={{display:'flex',gap:10}}><button className="btn btn-primary" onClick={()=>setCreating(true)}><Plus size={16}/> Manual commission</button><Link href="/dashboard/settings" className="btn btn-outline">Configure rates <ExternalLink size={16}/></Link></div>}/>
 {error&&<div className="alert-error">{error}</div>}
 {notice&&<div className="notice">{notice}</div>}
 <div className="metric-grid"><div className="metric-card"><div className="metric-icon blue"><Banknote/></div><span>Eligible</span><strong>K{totals.eligible.toFixed(2)}</strong></div><div className="metric-card"><div className="metric-icon green"><CheckCircle2/></div><span>Paid</span><strong>K{totals.paid.toFixed(2)}</strong></div><div className="metric-card"><div className="metric-icon amber"><Clock/></div><span>Awaiting payment</span><strong>K{totals.pending.toFixed(2)}</strong></div></div>
 <div className="panel"><div className="panel-title" style={{flexWrap:'wrap',gap:12}}><div><h2>Agent commission ledger</h2><p>Payment references can be recorded here or in Applications.</p></div>
 <div style={{display:'flex',gap:8,alignItems:'center',marginLeft:'auto'}}>
  <select className="form-select" value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter commissions"><option value="all">All</option><option value="pending">Pending</option><option value="paid">Paid</option></select>
  {selectedSubIds.size > 0 && <button className="btn btn-outline" disabled={busy} onClick={() => setBulkDeleteTarget('selected')} style={{fontSize:12,padding:'6px 12px',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',display:'inline-flex',alignItems:'center',gap:6}}><Trash2 size={14}/> Void Selected ({selectedSubIds.size})</button>}
  {filtered.length > 0 && <button className="btn btn-outline" disabled={busy} onClick={() => setBulkDeleteTarget('all')} style={{fontSize:12,padding:'6px 12px',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',display:'inline-flex',alignItems:'center',gap:6}}><Trash2 size={14}/> Void All ({filtered.length})</button>}
 </div></div>
 <div className="table-scroll"><table className="data-table"><thead><tr><th style={{width:40}}><input type="checkbox" checked={allCommissionsSelected} onChange={toggleSelectAllCommissions} aria-label="Select all commissions"/></th><th>Application</th><th>Agent ID</th><th>Eligibility</th><th>Amount</th><th>Status</th><th>Evidence / Ref</th><th>Actions</th></tr></thead><tbody>{filtered.map(x=><tr key={x.submissionId}><td><input type="checkbox" checked={selectedSubIds.has(x.submissionId)} onChange={() => toggleSelectCommission(x.submissionId)} aria-label={`Select ${x.reference}`}/></td><td><strong>{x.reference}</strong></td><td><small>{x.agentId}</small></td><td>{x.trigger==='payment'?'Tuition payment':'CDF approval'}</td><td>K{x.amount.toFixed(2)}</td><td><span className={'tag '+(x.paidAt?'tag-green':'tag-amber')}>{x.paidAt?'Paid':'Pending'}</span></td><td>{x.paymentReference||x.fundingEvidence||'—'}</td><td><div style={{display:'flex',gap:8,alignItems:'center'}}><button className="text-link" onClick={()=>{setEditing(x);setPaymentRef(x.paymentReference||'');setPayAmount(String(x.amount));}}>{x.paidAt?'Edit':'Record payment'}</button><button className="icon-btn" style={{color:'#ef4444'}} title="Void commission" onClick={()=>setDeletingCommission(x)} aria-label="Void commission"><Trash2 size={15}/></button></div></td></tr>)}{!filtered.length&&<tr><td colSpan={8} className="empty-state">No eligible commissions found.</td></tr>}</tbody></table></div></div>

 {editing&&(
  <div className="modal-page-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null);}}>
   <div className="modal-page" style={{maxWidth:600}} role="dialog" aria-modal="true" aria-label="Record Commission Payment">
    <div className="modal-page-header">
     <div className="modal-page-header-left">
      <span className="modal-page-badge">LEDGER</span>
      <h2>Record Commission Payment</h2>
     </div>
     <button className="icon-btn" onClick={()=>setEditing(null)} aria-label="Close"><X size={20}/></button>
    </div>
    <form onSubmit={e=>void savePayment(e)} style={{display:'flex',flexDirection:'column',flex:1}}>
     <div className="modal-page-body">
      <div className="modal-page-card">
       <p className="muted">Application Reference: <strong>{editing.reference}</strong> (Agent: {editing.agentId})</p>
       <div className="form-grid">
        <div className="field full"><label>Verified bank or mobile money transfer reference *</label><input required placeholder="E.g. TXN-89234823 or Cheque 0021" value={paymentRef} onChange={e=>setPaymentRef(e.target.value)}/></div>
        <div className="field"><label>Amount paid (ZMW) *</label><input type="number" min="1" step="0.01" required value={payAmount} onChange={e=>setPayAmount(e.target.value)}/></div>
       </div>
      </div>
     </div>
     <div className="modal-page-footer">
      <button type="button" className="btn btn-outline" onClick={()=>setEditing(null)}>Cancel</button>
      <button type="submit" className="btn btn-primary" disabled={busy||!paymentRef.trim()}><Save size={16}/>{busy?'Saving…':'Save payment record'}</button>
     </div>
    </form>
   </div>
  </div>
 )}

 {creating&&(
  <div className="modal-page-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setCreating(false);}}>
   <div className="modal-page" style={{maxWidth:600}} role="dialog" aria-modal="true" aria-label="Create Manual Commission">
    <div className="modal-page-header">
     <div className="modal-page-header-left">
      <span className="modal-page-badge">MANUAL ASSIGNMENT</span>
      <h2>Award Commission Record</h2>
     </div>
     <button className="icon-btn" onClick={()=>setCreating(false)} aria-label="Close"><X size={20}/></button>
    </div>
    <form onSubmit={e=>void createManualCommission(e)} style={{display:'flex',flexDirection:'column',flex:1}}>
     <div className="modal-page-body">
      <div className="modal-page-card">
       <div className="form-grid">
        <div className="field full"><label>Submission ID *</label><input required placeholder="Paste application UUID or record ID" value={newSubId} onChange={e=>setNewSubId(e.target.value)}/></div>
        <div className="field full"><label>Agent User ID / Agent Code *</label><input required placeholder="Paste agent UID" value={newAgentId} onChange={e=>setNewAgentId(e.target.value)}/></div>
        <div className="field"><label>Commission Amount (ZMW) *</label><input type="number" min="1" required value={newAmount} onChange={e=>setNewAmount(e.target.value)}/></div>
       </div>
      </div>
     </div>
     <div className="modal-page-footer">
      <button type="button" className="btn btn-outline" onClick={()=>setCreating(false)}>Cancel</button>
      <button type="submit" className="btn btn-primary" disabled={busy||!newSubId.trim()||!newAgentId.trim()}><Plus size={16}/>{busy?'Saving…':'Record commission'}</button>
     </div>
    </form>
   </div>
  </div>
 )}

 <ConfirmModal
  isOpen={Boolean(deletingCommission)}
  title="Void Agent Commission"
  message={`Are you sure you want to void the commission of K${deletingCommission?.amount} on application ${deletingCommission?.reference}?`}
  kind="danger"
  confirmLabel="Void Commission"
  cancelLabel="Cancel"
  busy={busy}
  onConfirm={()=>void confirmDeleteCommission()}
  onCancel={()=>setDeletingCommission(null)}
 />

 <ConfirmModal
  isOpen={Boolean(bulkDeleteTarget)}
  title="Void Multiple Commissions"
  message={`Are you sure you want to void ${bulkDeleteTarget === 'selected' ? `${selectedSubIds.size} selected` : `all ${filtered.length}`} commission record(s)?`}
  kind="danger"
  confirmLabel="Void Commissions"
  cancelLabel="Cancel"
  busy={busy}
  onConfirm={()=>void confirmBulkDeleteCommissions()}
  onCancel={()=>setBulkDeleteTarget(null)}
 />
</>;
}
