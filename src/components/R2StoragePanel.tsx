'use client';
import {useCallback,useEffect,useState} from 'react';
import {Cloud,CloudOff,FolderUp,Link2,LockKeyhole,ShieldCheck,Trash2} from 'lucide-react';
import {authHeaders} from '@/lib/firebase-client';
import {uploadToR2,r2ReadUrl} from '@/lib/r2-upload-client';
type Connection={id:string;label:string;accountId:string;bucket:string;jurisdiction:string;status:string;createdAt:string};
type PrivateFile={id:string;fileName:string;purpose:string;byteSize:number;connectionId:string;createdAt:string;sharedCount:number};
type Configuration={platformAvailable:boolean;connections:Connection[]};
async function request<T>(path:string,init:RequestInit={}):Promise<T>{
 const headers=await authHeaders(),response=await fetch(path,{...init,headers:{...headers,...(init.body?{'Content-Type':'application/json'}:{}),...init.headers},cache:'no-store'});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'Storage request failed.');
 return result as T;
}
export function R2StoragePanel({onPhotoUploaded}:{onPhotoUploaded?:(fileId:string)=>void}){
 const [config,setConfig]=useState<Configuration>({platformAvailable:false,connections:[]});
 const [files,setFiles]=useState<PrivateFile[]>([]);
 const [selected,setSelected]=useState('platform');
 const [label,setLabel]=useState('My private R2 bucket');
 const [accountId,setAccountId]=useState(''),[bucket,setBucket]=useState(''),[jurisdiction,setJurisdiction]=useState('default');
 const [accessKeyId,setAccessKeyId]=useState(''),[secretAccessKey,setSecretAccessKey]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [showConnect,setShowConnect]=useState(false);
 const refresh=useCallback(async()=>{
  const [b,f]=await Promise.all([
   request<Configuration>('/api/r2/connections'),request<{files:PrivateFile[]}>('/api/r2/files')
  ]);
  setConfig(b);setFiles(f.files);
  setSelected(old=>old!=='platform'&&b.connections.some(c=>c.id===old&&c.status==='active')?old:
   b.connections.find(c=>c.status==='active')?.id||(b.platformAvailable?'platform':''));
 },[]);
 useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:'Storage unavailable.'));},[refresh]);
 async function connect(event:React.FormEvent){
  event.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   await request('/api/r2/connections',{method:'POST',body:JSON.stringify({label,accountId,bucket,
    jurisdiction,accessKeyId,secretAccessKey})});
   setAccessKeyId('');setSecretAccessKey('');setAccountId('');setBucket('');setShowConnect(false);
   await refresh();setMessage('R2 bucket connected. You can now upload files into your own bucket.');
  }catch(e){setError(e instanceof Error?e.message:'Connection failed.');}
  finally{setBusy(false);}
 }
 async function disconnect(c:Connection){
  if(!window.confirm('Disconnect '+c.label+'? KASA will permanently destroy its stored credentials. Files remain in YOUR R2 bucket but will no longer open in KASA. Continue?'))return;
  setBusy(true);setError('');
  try{await request('/api/r2/connections/'+encodeURIComponent(c.id),{method:'DELETE',body:JSON.stringify({confirm:true})});await refresh();setMessage('Bucket disconnected. No objects were deleted.');}
  catch(e){setError(e instanceof Error?e.message:'Disconnect failed.');}finally{setBusy(false);}
 }
 async function upload(file:File,purpose:'profile-photo'|'personal-document'){
  if(!selected)throw Error('Connect your own bucket or ask KASA to configure its platform bucket.');
  if(file.size>25*1024*1024)throw Error('Maximum file size is 25 MB.');
  setBusy(true);setError('');setMessage('');
  try{
   const fileId=await uploadToR2(file,purpose,selected);
   if(purpose==='profile-photo'){
    await request('/api/profile/photo',{method:'PATCH',body:JSON.stringify({fileId})});
    onPhotoUploaded?.(fileId);
   }
   await refresh();setMessage(purpose==='profile-photo'?'Profile photo saved to R2.':'Document uploaded privately to R2.');
  }catch(e){setError(e instanceof Error?e.message:'Upload failed.');}
  finally{setBusy(false);}
 }
 async function openFile(id:string){
  setError('');
  try{const url=await r2ReadUrl(id);window.open(url,'_blank','noopener,noreferrer');}
  catch(e){setError(e instanceof Error?e.message:'Unable to open file.');}
 }
 return <section className="profile-section-card" aria-label="Cloudflare R2 storage">
  <h2><Cloud size={20}/> My private storage · Cloudflare R2</h2>
  <p>Upload photos and documents directly without visiting Cloudinary. KASA keeps file metadata in Firebase Firestore. A personal bucket remains yours; KASA never owns its contents.</p>
  {error&&<p className="alert-error" role="alert">{error}</p>}
  {message&&<p className="notice" role="status">{message}</p>}
  <label className="field">Where new files are stored
   <select value={selected} onChange={e=>setSelected(e.target.value)}>
    {config.platformAvailable&&<option value="platform">KASA managed private R2</option>}
    {config.connections.filter(c=>c.status==='active').map(c=><option key={c.id} value={c.id}>{c.label} ({c.bucket}) — my bucket</option>)}
    {!config.platformAvailable&&!config.connections.some(c=>c.status==='active')&&<option value="">Connect an R2 bucket to enable uploads</option>}
   </select>
  </label>
  <div style={{display:'flex',flexWrap:'wrap',gap:12,margin:'16px 0'}}>
   <label className="btn btn-outline" style={{cursor:busy?'not-allowed':'pointer'}}><FolderUp size={17}/> Upload profile photo
    <input type="file" accept="image/png,image/jpeg" hidden disabled={busy||!selected} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f,'profile-photo');e.target.value='';}}/>
   </label>
   <label className="btn btn-outline" style={{cursor:busy?'not-allowed':'pointer'}}><FolderUp size={17}/> Upload private document
    <input type="file" accept="application/pdf,image/png,image/jpeg" hidden disabled={busy||!selected} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f,'personal-document');e.target.value='';}}/>
   </label>
  </div>
  <h3><LockKeyhole size={17}/> My uploaded files</h3>
  <div style={{display:'grid',gap:8}}>
   {files.slice(0,40).map(file=><div key={file.id} style={{display:'flex',gap:12,justifyContent:'space-between',borderBottom:'1px solid #d9e6dd',padding:'8px 0',flexWrap:'wrap'}}>
    <div><b>{file.fileName}</b><div className="muted" style={{fontSize:12}}>{(file.byteSize/1024).toFixed(1)} KB · {file.purpose==='profile-photo'?'Profile image':'Private document'} · {file.sharedCount} shares</div></div>
    <button className="btn btn-outline" disabled={busy} type="button" onClick={()=>void openFile(file.id)}><Link2 size={16}/> Open securely</button>
   </div>)}
   {!files.length&&<p className="muted">No R2 files yet. Existing Cloudinary and Firebase documents remain available while migration is prepared.</p>}
  </div>
  <div style={{marginTop:20,borderTop:'1px solid #d9e6dd',paddingTop:15}}>
   <h3><ShieldCheck size={17}/> Bring your own bucket (BYOB)</h3>
   <p className="muted">In Cloudflare, create a private R2 bucket, issue an <strong>Object Read & Write</strong> token scoped only to that bucket, and configure bucket CORS for the KASA website origin and PUT Content-Type.</p>
   {config.connections.map(c=><div key={c.id} style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
    <span><b>{c.label}</b> · {c.bucket} · {c.status}</span>
    {c.status==='active'&&<button className="btn btn-outline" type="button" disabled={busy} onClick={()=>void disconnect(c)}><Trash2 size={15}/> Disconnect</button>}
   </div>)}
   <button type="button" className="btn btn-outline" onClick={()=>setShowConnect(x=>!x)}>{showConnect?<CloudOff size={16}/>:<Cloud size={16}/>} {showConnect?'Cancel connection':'Connect my R2 bucket'}</button>
   {showConnect&&<form onSubmit={e=>void connect(e)} className="form-grid" style={{marginTop:15}}>
    <div className="field full"><label>Connection label</label><input required value={label} onChange={e=>setLabel(e.target.value)}/></div>
    <div className="field"><label>Cloudflare account ID</label><input required value={accountId} maxLength={32} onChange={e=>setAccountId(e.target.value.trim())}/></div>
    <div className="field"><label>Bucket name</label><input required value={bucket} onChange={e=>setBucket(e.target.value.trim())}/></div>
    <div className="field"><label>Jurisdiction</label><select value={jurisdiction} onChange={e=>setJurisdiction(e.target.value)}><option value="default">Default</option><option value="eu">EU</option><option value="us">US</option><option value="fedramp">FedRAMP</option></select></div>
    <div className="field"><label>Access key ID</label><input required autoComplete="off" value={accessKeyId} onChange={e=>setAccessKeyId(e.target.value)}/></div>
    <div className="field full"><label>Secret access key (encrypted on the server)</label><input required type="password" autoComplete="new-password" value={secretAccessKey} onChange={e=>setSecretAccessKey(e.target.value)}/></div>
    <button className="btn btn-primary" type="submit" disabled={busy}><ShieldCheck size={17}/> {busy?'Connecting…':'Verify & connect bucket'}</button>
   </form>}
   <p className="muted" style={{marginTop:12}}>Do not provide an account-wide Cloudflare token. Disconnect destroys the stored encrypted credentials, never the objects in your bucket. If you revoke the key in Cloudflare, future reads and uploads stop until you reconnect.</p>
  </div>
 </section>;
}
