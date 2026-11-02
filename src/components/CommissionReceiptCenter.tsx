'use client';
import {useEffect,useState} from 'react';
import {authHeaders} from '@/lib/firebase-client';
type Receipt={
 id:string;reference:string;amountMinor:number;currency:string;transactionId:string;
 status:'awaiting_confirmation'|'confirmed'|'disputed';recordedAt:string;
 confirmedAt?:string|null;disputedAt?:string|null;discrepancyNote?:string;
 confirmedAmountMinor?:number|null;reportedAmountMinor?:number|null
};
type Api={receipts:Receipt[];partial:boolean};
const k=(minor:number)=>'K'+(minor/100).toLocaleString('en-ZM',{minimumFractionDigits:2,maximumFractionDigits:2});
export function CommissionReceiptCenter({admin=false}:{admin?:boolean}){
 const [receipts,setReceipts]=useState<Receipt[]>([]),[partial,setPartial]=useState(false);
 const [active,setActive]=useState(''),[amount,setAmount]=useState(''),[reference,setReference]=useState('');
 const [reason,setReason]=useState(''),[checked,setChecked]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){
  const headers=await authHeaders();
  const res=await fetch('/api/commission-receipts',{headers,cache:'no-store'});
  if(!res.ok)throw Error('Unable to load commission receipts.');
  const data:Api=await res.json();setReceipts(data.receipts||[]);setPartial(Boolean(data.partial));
 }
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:'Unable to load receipts.'));},[]);
 function edit(receipt:Receipt){
  setActive(receipt.id);setAmount('');setReference('');setReason('');setChecked(false);setError('');setNotice('');
 }
 async function submit(receipt:Receipt,action:'confirm'|'dispute'){
  setError('');setNotice('');
  if(!checked){setError('First check the incoming transaction on your own mobile-money or bank account.');return;}
  const value=Number(amount);
  if(amount.trim()===''||!Number.isFinite(value)||value<0){setError('Enter the actual amount received. Enter 0 if nothing arrived.');return;}
  if(action==='dispute'&&reason.trim().length<10){setError('Explain the difference or missing payment.');return;}
  setBusy(true);
  try{
   const headers=await authHeaders();
   const res=await fetch('/api/commission-receipts',{method:'POST',
    headers:{...headers,'content-type':'application/json'},body:JSON.stringify({
     submissionId:receipt.id,action,amountReceived:value,transactionId:reference.trim(),note:reason.trim()
    })});
   const out=await res.json();
   if(!res.ok)throw Error(out.error||'Could not save acknowledgement.');
   setNotice(out.message||'Your response was recorded.');setActive('');await load();
  }catch(e){setError(e instanceof Error?e.message:'Unable to save acknowledgement.');}
  finally{setBusy(false);}
 }
 async function pdf(receipt:Receipt){
  setError('');
  try{
   const headers=await authHeaders();
   const res=await fetch('/api/commission-receipts/'+encodeURIComponent(receipt.id)+'/pdf',{headers,cache:'no-store'});
   if(!res.ok)throw Error('Could not create your receipt PDF.');
   const blob=await res.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download='KASA-Commission-Receipt-'+receipt.id+'.pdf';document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),5000);
  }catch(e){setError(e instanceof Error?e.message:'Download failed.');}
 }
 return <section className="panel" style={{marginTop:24}}>
  <div className="panel-title"><div><h2>{admin?'Recipient payout acknowledgements':'My commission payment receipts'}</h2>
   <p>{admin?'Track confirmed, awaiting and disputed payouts. A recipient acknowledgement does not independently verify bank settlement.':
    'A receipt is generated whenever KASA records a transfer. Verify it against your own bank or mobile-money statement before confirming.'}</p></div></div>
  {error&&<p className="alert-error" role="alert">{error}</p>}
  {notice&&<p className="notice" role="status">{notice}</p>}
  {partial&&<p className="alert-error">Results are capped; contact finance for a complete payout statement.</p>}
  <div className="table-scroll"><table className="data-table"><thead>
   <tr><th>Reference</th><th>Recorded amount</th><th>Transfer ID</th><th>Recipient response</th><th>Receipt</th></tr>
  </thead><tbody>
  {receipts.map(r=><tr key={r.id}><td>{r.reference}<small style={{display:'block'}}>{r.recordedAt?.slice(0,10)}</small></td>
   <td>{k(r.amountMinor)}</td><td>{r.transactionId}</td>
   <td><strong>{r.status.replace(/_/g,' ')}</strong>
    {r.status==='disputed'&&<p className="muted">{r.discrepancyNote||'Investigation required'}</p>}
    {!admin&&r.status==='awaiting_confirmation'&&<button className="btn btn-outline" type="button" onClick={()=>edit(r)}>Confirm or report problem</button>}
   </td><td><button type="button" className="btn btn-outline" onClick={()=>void pdf(r)}>Download PDF</button></td>
  </tr>)}
  {!receipts.length&&<tr><td colSpan={5}>No recorded commission payouts yet.</td></tr>}
  </tbody></table></div>
  {!admin&&active&&receipts.filter(r=>r.id===active&&r.status==='awaiting_confirmation').map(r=><form key={r.id}
   onSubmit={e=>{e.preventDefault();void submit(r,'confirm');}} className="panel pad-panel" style={{margin:16}}>
   <h3>Confirm your payment — {r.reference}</h3>
   <p>KASA recorded <strong>{k(r.amountMinor)}</strong> with transaction ID <strong>{r.transactionId}</strong>. Check your personal statement and enter the amount and transaction ID you actually received.</p>
   <div className="field"><label htmlFor="receipt-amount">Actual amount received (K)</label>
    <input id="receipt-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} required onChange={e=>setAmount(e.target.value)} placeholder="Enter amount you actually received"/>
   </div>
   <div className="field"><label htmlFor="receipt-id">Transaction ID from your own bank or mobile-money notification</label>
    <input id="receipt-id" value={reference} maxLength={160} onChange={e=>setReference(e.target.value)} placeholder="Enter transaction ID or leave blank if missing"/>
   </div>
   <label className="required-toggle"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>
     I checked my own account or statement, not just the details supplied by KASA.</label>
   <div className="field"><label htmlFor="receipt-note">Problem description (required only for a dispute)</label>
    <textarea id="receipt-note" value={reason} rows={3} maxLength={600} onChange={e=>setReason(e.target.value)} placeholder="Missing payment, different amount, or different transaction ID"/>
   </div>
   <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
    <button type="submit" className="btn btn-primary" disabled={busy||!checked||!amount.trim()||reference.trim().length<5}>{busy?'Saving…':'Confirm exact payment'}</button>
    <button type="button" className="btn btn-outline" disabled={busy||!checked||reason.trim().length<10} onClick={()=>void submit(r,'dispute')}>Report a problem</button>
    <button type="button" className="btn btn-outline" onClick={()=>setActive('')}>Cancel</button>
   </div>
   <p className="muted">Only an exact match can be confirmed. If the amount or ID differs, use Report a problem. Confirmation is recorded with your authenticated account and cannot be silently edited.</p>
  </form>)}
 </section>;
}
