'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Cloud,CheckCircle2,LoaderCircle} from 'lucide-react';
import {authorizeExternalStorage,storageJson} from '@/lib/r2-upload-client';
type Status={connected:boolean;connectionId:string|null;selectedBucket:{bucket:string}|null};
export function ExternalStorageConnection({onReady}:{onReady?:(id:string)=>void}){
 const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [accounts,setAccounts]=useState<{id:string;name:string}[]>([]);
 const [available,setAvailable]=useState(true);
 const callback=useRef(onReady);callback.current=onReady;
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{
   const readiness=await storageJson<{available:boolean;message:string}>('/api/r2/oauth/readiness');
   setAvailable(readiness.available);
   if(!readiness.available){setError(readiness.message);setStatus(null);return;}
   const state=await storageJson<Status>('/api/r2/oauth');setStatus(state);
   const url=new URL(location.href),result=url.searchParams.get('cloudflare');
   if(result){url.searchParams.delete('cloudflare');history.replaceState(null,'',url.pathname+url.search+url.hash);}
   if(result&&result!=='connected')setError(result==='cancelled'?'Cloudflare authorization was cancelled. Your application progress is saved.':'Cloudflare authorization could not be completed. Your progress is saved; try connecting again.');
   if(state.connected&&state.connectionId){callback.current?.(state.connectionId);return;}
   if(state.connected){
    const setup=await storageJson<{accounts?:{id:string;name:string}[];connectionId?:string;selectedBucket?:{bucket:string}}>('/api/r2/oauth/provision',{});
    if(setup.accounts)setAccounts(setup.accounts);
    if(setup.connectionId){setStatus({connected:true,connectionId:setup.connectionId,selectedBucket:setup.selectedBucket||null});callback.current?.(setup.connectionId);}
   }
  }catch(e){
   // First-time applicants have no storage cookie until they choose to authorize.
   if(e instanceof Error&&!/Authorize your storage/.test(e.message))setError(e.message);
  }finally{setBusy(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 async function connect(){setBusy(true);setError('');try{await authorizeExternalStorage();}catch(e){setError(e instanceof Error?e.message:'Unable to connect.');setBusy(false);}}
 async function choose(accountId:string){
  setBusy(true);setError('');
  try{await storageJson('/api/r2/oauth/provision',{accountId});setAccounts([]);await load();}
  catch(e){setError(e instanceof Error?e.message:'Unable to prepare your storage.');setBusy(false);}
 }
 async function disconnect(){
  if(!window.confirm('Disconnect your external storage? Your files remain in Cloudflare. KASA will lose access.'))return;
  setBusy(true);try{await storageJson('/api/r2/oauth/disconnect',{});setStatus(null);callback.current?.('');}
  catch(e){setError(e instanceof Error?e.message:'Unable to disconnect.');}finally{setBusy(false);}
 }
 return <div className="external-storage-connect">
  <div><Cloud size={20} aria-hidden="true"/><strong>Your external storage</strong></div>
  <p>Authorize Cloudflare once. Files upload directly to a private bucket in your Cloudflare account. KASA keeps file references and permissions. Your provider’s storage limits and billing apply.</p>
  {busy?<p role="status"><LoaderCircle className="spin" size={16}/> Preparing your connection…</p>:status?.connectionId?<div className="actions"><span role="status"><CheckCircle2 size={16}/> Connected: {status.selectedBucket?.bucket||'your private bucket'}</span><button type="button" className="text-link" onClick={()=>void disconnect()}>Disconnect</button></div>:accounts.length?<div><label htmlFor="cloudflare-account">Choose your Cloudflare account</label><select id="cloudflare-account" defaultValue="" onChange={e=>void choose(e.target.value)}><option value="" disabled>Select account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>:<button type="button" className="btn btn-primary" disabled={!available} onClick={()=>void connect()}><Cloud size={17}/> Connect with Cloudflare</button>}
  {error&&<div role="alert" className="alert-error">{error} <button type="button" className="text-link" disabled={busy} onClick={()=>void load()}>Try again</button></div>}
 </div>;
}
