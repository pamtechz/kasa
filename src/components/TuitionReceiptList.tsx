'use client';
import {useState} from 'react';
import {authHeaders} from '@/lib/firebase-client';

type Receipt={id:string;applicationReference:string;amountMinor:number;totalPaidMinor:number;feeTotalMinor:number;
 paymentMethod:string;transactionId:string;recordedAt:string;status:string};
const money=(n:number)=>'K'+(n/100).toLocaleString('en-ZM',{minimumFractionDigits:2,maximumFractionDigits:2});
export function TuitionReceiptList({submissionId}:{submissionId:string}){
 const [open,setOpen]=useState(false),[loading,setLoading]=useState(false);
 const [items,setItems]=useState<Receipt[]>([]),[partial,setPartial]=useState(false),[error,setError]=useState('');
 async function refresh(){
  setLoading(true);setError('');
  try{
   const headers=await authHeaders();
   const res=await fetch('/api/tuition-receipts?submissionId='+encodeURIComponent(submissionId),{headers,cache:'no-store'});
   const data=await res.json();
   if(!res.ok)throw Error(data.error||'Unable to load tuition receipts.');
   setItems(data.receipts||[]);setPartial(Boolean(data.partial));setOpen(true);
  }catch(e){setError(e instanceof Error?e.message:'Unable to load receipts.');}
  finally{setLoading(false);}
 }
 async function download(receiptId:string){
  setError('');
  try{
   const headers=await authHeaders();
   const res=await fetch('/api/tuition-receipts/'+encodeURIComponent(receiptId)+'/pdf',{headers,cache:'no-store'});
   if(!res.ok)throw Error('Receipt PDF is unavailable.');
   const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='KASA-Tuition-Receipt-'+receiptId.slice(0,12)+'.pdf';
   document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }catch(e){setError(e instanceof Error?e.message:'Receipt could not be downloaded.');}
 }
 return <section className="panel pad-panel" style={{marginTop:12}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
   <div><strong>Tuition payment receipts</strong><p className="muted" style={{margin:'4px 0'}}>Each verified installment has its own downloadable proof and transaction ID.</p></div>
   <button type="button" className="btn btn-outline" disabled={loading} onClick={()=>open?setOpen(false):void refresh()}>
    {loading?'Loading receipts…':open?'Hide receipts':'View / download receipts'}
   </button>
  </div>
  {error&&<p className="alert-error" role="alert">{error}</p>}
  {open&&<div style={{marginTop:12}}>
   {partial&&<p className="muted">More receipts may exist. Contact Finance for a full statement.</p>}
   {!items.length?<p className="muted">No recorded payments for this application.</p>:
    <div className="table-scroll"><table className="data-table">
     <thead><tr><th>Date</th><th>Amount paid</th><th>Paid to date</th><th>Reference</th><th>PDF</th></tr></thead>
     <tbody>{items.map(x=><tr key={x.id}><td>{x.recordedAt?.slice(0,10)||'—'}</td>
      <td>{money(x.amountMinor)}</td><td>{money(x.totalPaidMinor)}</td><td>{x.transactionId}</td>
      <td><button className="btn btn-outline" type="button" onClick={()=>void download(x.id)}>Download</button></td>
     </tr>)}</tbody>
    </table></div>}
   <p className="muted">A payment receipt does not by itself confirm enrollment or authorize commission. KASA verifies those separately once full fees are received.</p>
  </div>}
 </section>;
}
