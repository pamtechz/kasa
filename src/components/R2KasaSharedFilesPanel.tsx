'use client';
import {useCallback,useEffect,useState} from 'react';
import {FileText,LockKeyhole,RefreshCw} from 'lucide-react';
import {authHeaders} from '@/lib/firebase-client';

type SharedFile={
 id:string;ownerUid:string;fileName:string;contentType:string;
 byteSize:number;sharedAt:string;provider:string;
};
async function request<T>(url:string):Promise<T>{
 const headers=await authHeaders();
 const response=await fetch(url,{headers,cache:'no-store'});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'Unable to load authorized documents.');
 return result as T;
}
export function R2KasaSharedFilesPanel(){
 const [files,setFiles]=useState<SharedFile[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const list=await request<{files:SharedFile[]}>('/api/admin/r2/shared');
   setFiles(list.files);
  }catch(e){setError(e instanceof Error?e.message:'Unable to load shared documents.');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function openFile(file:SharedFile){
  setError('');
  try{
   const result=await request<{url:string}>('/api/admin/r2/shared/'+encodeURIComponent(file.id));
   // Short-lived signed link grants read access to this exact object only.
   window.open(result.url,'_blank','noopener,noreferrer');
  }catch(e){setError(e instanceof Error?e.message:'This file is no longer available.');}
 }
 return <section className="profile-section-card" aria-label="User-owned documents shared with KASA">
  <h2><LockKeyhole size={18}/> Documents shared with KASA</h2>
  <p className="muted">Only documents explicitly authorized by their owners appear here. Files stay in the owners’ Cloudflare R2 buckets. Revoked or disconnected documents cannot be reopened.</p>
  {error&&<p className="alert-error" role="alert">{error}</p>}
  <button type="button" className="btn btn-outline" disabled={loading} onClick={()=>void refresh()}>
   <RefreshCw size={16}/> {loading?'Loading…':'Refresh shared files'}
  </button>
  {files.length===0&&!loading&&<p className="muted">No privately owned documents are shared with KASA yet.</p>}
  <div style={{display:'grid',gap:8,marginTop:12}}>
   {files.map(file=><div className="admin-edit-item" key={file.id}>
    <div><strong><FileText size={16}/> {file.fileName}</strong>
     <div className="muted" style={{fontSize:12}}>Owner ID: {file.ownerUid} · {(file.byteSize/1024).toFixed(1)} KB · Shared: {file.sharedAt?.slice(0,10)||'Unknown'}</div>
    </div>
    <button type="button" className="btn btn-outline" onClick={()=>void openFile(file)}>Open authorized document</button>
   </div>)}
  </div>
 </section>;
}
