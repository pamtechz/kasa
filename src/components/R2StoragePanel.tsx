'use client';
import {useCallback,useEffect,useState} from 'react';
import {FolderUp,LockKeyhole,Link2} from 'lucide-react';
import {ExternalStorageConnection} from './ExternalStorageConnection';
import {uploadToR2,r2ReadUrl,storageJson,externalStorageHeaders} from '@/lib/r2-upload-client';
type PrivateFile={id:string;fileName:string;purpose:string;byteSize:number;sharedWithKasa:boolean};
export function R2StoragePanel({onPhotoUploaded}:{onPhotoUploaded?:(fileId:string)=>void;administrator?:boolean}){
 const [files,setFiles]=useState<PrivateFile[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [connection,setConnection]=useState('');
 const refresh=useCallback(async()=>{const data=await storageJson<{files:PrivateFile[]}>('/api/r2/files');setFiles(data.files);},[]);
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[refresh]);
 async function upload(file:File,purpose:'profile-photo'|'personal-document'){
  setBusy(true);setError('');setMessage('');
  try{
   const id=await uploadToR2(file,purpose,connection||undefined);
   if(purpose==='profile-photo'){
    const headers=await externalStorageHeaders();
    const response=await fetch('/api/profile/photo',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({fileId:id})});
    if(!response.ok)throw Error((await response.json()).error||'Unable to save your photo.');
    onPhotoUploaded?.(id);
   }
   await refresh();setMessage(purpose==='profile-photo'?'Profile photo saved.':'Document uploaded privately to your external storage.');
  }catch(e){setError(e instanceof Error?e.message:'Upload failed.');}finally{setBusy(false);}
 }
 async function share(file:PrivateFile){
  setBusy(true);setError('');
  try{
   const headers=await externalStorageHeaders();
   const response=await fetch('/api/r2/files/'+file.id+'/kasa-access',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({approved:!file.sharedWithKasa})});
   if(!response.ok)throw Error((await response.json()).error||'Unable to update access.');
   await refresh();setMessage(file.sharedWithKasa?'KASA access revoked. Existing links expire within 90 seconds.':'This document is now available to authorized KASA staff.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to share file.');}finally{setBusy(false);}
 }
 async function open(id:string){
  setError('');try{window.open(await r2ReadUrl(id),'_blank','noopener,noreferrer');}catch(e){setError(e instanceof Error?e.message:'Unable to open file.');}
 }
 return <section className="profile-section-card" aria-label="External file storage">
  <h2><LockKeyhole size={20}/> My files</h2>
  <ExternalStorageConnection onReady={setConnection}/>
  {error&&<p role="alert" className="alert-error">{error}</p>}{message&&<p role="status" className="notice">{message}</p>}
  <div className="actions" style={{margin:'16px 0'}}>{(['profile-photo','personal-document'] as const).map(p=><label className="btn btn-outline" key={p}><FolderUp size={17}/>{p==='profile-photo'?'Choose profile photo':'Choose private document'}<input type="file" hidden accept={p==='profile-photo'?'image/png,image/jpeg':'application/pdf,image/png,image/jpeg'} disabled={busy||!connection} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f,p);e.target.value='';}}/></label>)}</div>
  <h3>My uploaded files</h3><p className="muted">Private documents are shared only when you choose Share with KASA. Existing files remain available.</p>
  {!files.length&&<p className="muted">Your uploaded files will appear here.</p>}
  {files.map(file=><div className="external-file-row" key={file.id}><div><strong>{file.fileName}</strong><small>{(file.byteSize/1024).toFixed(1)} KB</small></div><div className="actions"><button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void open(file.id)}><Link2 size={15}/> Open</button>{file.purpose==='personal-document'&&<button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void share(file)}>{file.sharedWithKasa?'Revoke KASA access':'Share with KASA'}</button>}</div></div>)}
 </section>;
}
