'use client';
import {useCallback,useEffect,useState} from 'react';
import {Cloud,CloudOff,FolderUp,Link2,LockKeyhole,ShieldCheck,Trash2} from 'lucide-react';
import {authHeaders} from '@/lib/firebase-client';
import {uploadToR2,r2ReadUrl} from '@/lib/r2-upload-client';
import {selectR2Destination} from '@/lib/r2-storage-selection';
type Connection={id:string;label:string;accountId:string;bucket:string;jurisdiction:string;status:string;createdAt:string};
type PrivateFile={id:string;fileName:string;purpose:string;byteSize:number;connectionId:string;createdAt:string;sharedCount:number;sharedWithKasa:boolean};
type Configuration={platformAvailable:boolean;byobAvailable:boolean;connections:Connection[]};
type OAuthStatus={available:boolean;connected:boolean;selectedBucket:{accountId:string;bucket:string;jurisdiction:string}|null};
type CloudflareAccount={id:string;name:string};
type CloudflareBucket={name:string;jurisdiction:string};
type AdminStatus={platformConfigured:boolean;missingVariables:string[];byobEncryptionConfigured:boolean;connectivity:'not_checked'|'not_configured'|'ready'|'rejected'|'unreachable'|'invalid_configuration'};
async function request<T>(path:string,init:RequestInit={}):Promise<T>{
 const headers=await authHeaders(),response=await fetch(path,{...init,headers:{...headers,...(init.body?{'Content-Type':'application/json'}:{}),...init.headers},cache:'no-store'});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'Storage request failed.');
 return result as T;
}
export function R2StoragePanel({onPhotoUploaded,administrator=false}:{onPhotoUploaded?:(fileId:string)=>void;administrator?:boolean}){
 const [config,setConfig]=useState<Configuration>({platformAvailable:false,byobAvailable:false,connections:[]});
 const [files,setFiles]=useState<PrivateFile[]>([]);
 const [selected,setSelected]=useState('');
 const [label,setLabel]=useState('My private R2 bucket');
 const [accountId,setAccountId]=useState(''),[bucket,setBucket]=useState(''),[jurisdiction,setJurisdiction]=useState('default');
 const [accessKeyId,setAccessKeyId]=useState(''),[secretAccessKey,setSecretAccessKey]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [showConnect,setShowConnect]=useState(false);
 const [showAdvanced,setShowAdvanced]=useState(false);
 const [oauth,setOauth]=useState<OAuthStatus>({available:false,connected:false,selectedBucket:null});
 const [accounts,setAccounts]=useState<CloudflareAccount[]>([]);
 const [selectedAccount,setSelectedAccount]=useState('');
 const [buckets,setBuckets]=useState<CloudflareBucket[]>([]);
 const [selectedBucket,setSelectedBucket]=useState('');
 const [oauthBusy,setOauthBusy]=useState(false);
 const [oauthError,setOauthError]=useState('');
 const [adminStatus,setAdminStatus]=useState<AdminStatus|null>(null);
 const [checkingStatus,setCheckingStatus]=useState(false);
 const [statusError,setStatusError]=useState('');
 const checkPlatform=useCallback(async(verify:boolean)=>{
  if(!administrator)return;
  setCheckingStatus(true);setStatusError('');
  try{
   const status=await request<AdminStatus>('/api/admin/settings/storage-status'+(verify?'?verify=1':''));
   setAdminStatus(status);
  }catch(e){setStatusError(e instanceof Error?e.message:'Storage status unavailable.');}
  finally{setCheckingStatus(false);}
 },[administrator]);
 const refresh=useCallback(async()=>{
  const [b,f,o]=await Promise.all([
   request<Configuration>('/api/r2/connections'),
   request<{files:PrivateFile[]}>('/api/r2/files'),
   request<OAuthStatus>('/api/r2/oauth')
  ]);
  setConfig(b);setFiles(f.files);setOauth(o);
  setSelected(old=>selectR2Destination(old,b));
 },[]);
 useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:'Storage unavailable.'));},[refresh]);
 useEffect(()=>{if(administrator)void checkPlatform(false);},[administrator,checkPlatform]);
 useEffect(()=>{
  if(!oauth.connected||oauth.selectedBucket)return;
  void discoverCloudflareBuckets();
 // Recheck only when connection state changes, avoiding duplicate consent calls.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[oauth.connected,oauth.selectedBucket?.bucket]);
 async function beginCloudflare(){
  setOauthBusy(true);setOauthError('');
  try{
   const result=await request<{url:string}>('/api/r2/oauth/start',{method:'POST'});
   // Cloudflare's own website handles sign-in and permission consent.
   window.location.assign(result.url);
  }catch(e){setOauthError(e instanceof Error?e.message:'Cloudflare sign-in unavailable.');setOauthBusy(false);}
 }
 async function chooseBucket(accountId:string,bucket:CloudflareBucket){
  await request('/api/r2/oauth/select',{method:'POST',body:JSON.stringify({
   accountId,bucket:bucket.name,jurisdiction:bucket.jurisdiction
  })});
  await refresh();
 }
 async function discoverCloudflareBuckets(){
  setOauthBusy(true);setOauthError('');
  try{
   const data=await request<{accounts:CloudflareAccount[]}>('/api/r2/oauth/accounts');
   setAccounts(data.accounts);
   if(data.accounts.length===1){
    const id=data.accounts[0].id;setSelectedAccount(id);
    const response=await request<{buckets:CloudflareBucket[]}>('/api/r2/oauth/buckets?accountId='+encodeURIComponent(id));
    setBuckets(response.buckets);
    if(response.buckets.length===1){
     await chooseBucket(id,response.buckets[0]);
     setMessage('Cloudflare connected automatically to your only available R2 bucket.');
     return;
    }
   }
   if(!data.accounts.length)setOauthError('No Cloudflare account was authorized. Check your consent.');
  }catch(e){setOauthError(e instanceof Error?e.message:'Could not discover your Cloudflare storage.');}
  finally{setOauthBusy(false);}
 }
 async function accountSelected(id:string){
  setSelectedAccount(id);setSelectedBucket('');setBuckets([]);
  if(!id)return;
  setOauthBusy(true);setOauthError('');
  try{
   const data=await request<{buckets:CloudflareBucket[]}>('/api/r2/oauth/buckets?accountId='+encodeURIComponent(id));
   setBuckets(data.buckets);
   if(!data.buckets.length)setOauthError('This account has no eligible R2 buckets. Select another account or create your bucket at Cloudflare.');
  }catch(e){setOauthError(e instanceof Error?e.message:'Unable to load Cloudflare buckets.');}
  finally{setOauthBusy(false);}
 }
 async function selectCloudflareBucket(){
  const bucket=buckets.find(b=>b.name===selectedBucket);
  if(!selectedAccount||!bucket)return;
  setOauthBusy(true);setOauthError('');
  try{await chooseBucket(selectedAccount,bucket);setMessage('Your Cloudflare R2 bucket is connected to KASA.');}
  catch(e){setOauthError(e instanceof Error?e.message:'Unable to select your bucket.');}
  finally{setOauthBusy(false);}
 }
 async function disconnectCloudflare(){
  if(!window.confirm('Disconnect Cloudflare from KASA? Your files stay in your own account, but KASA will no longer be able to access them through this connection.'))return;
  setOauthBusy(true);setOauthError('');
  try{
   await request('/api/r2/oauth/disconnect',{method:'POST'});
   await refresh();setAccounts([]);setBuckets([]);
   setMessage('Cloudflare disconnected from KASA. To invalidate provider authorization, also revoke KASA under Cloudflare authorized applications.');
  }catch(e){setOauthError(e instanceof Error?e.message:'Unable to disconnect Cloudflare.');}
  finally{setOauthBusy(false);}
 }
 async function uploadCloudflare(file:File){
  setOauthBusy(true);setOauthError('');setMessage('');
  try{
   if(file.size>3*1024*1024)throw Error('One-click Cloudflare uploads currently support up to 3 MB. For larger documents use the advanced R2 connection.');
   const data=new FormData();data.append('file',file);
   const headers=await authHeaders();
   const response=await fetch('/api/r2/oauth/upload',{method:'POST',headers,body:data,cache:'no-store'});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'Upload failed.');
   await refresh();setMessage('Your private document was uploaded into your own Cloudflare R2 bucket.');
  }catch(e){setOauthError(e instanceof Error?e.message:'Unable to upload document.');}
  finally{setOauthBusy(false);}
 }
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
 async function grantKasaAccess(file:PrivateFile){
  setBusy(true);setError('');setMessage('');
  try{
   await request('/api/r2/files/'+encodeURIComponent(file.id)+'/kasa-access',{
    method:'PATCH',body:JSON.stringify({approved:!file.sharedWithKasa})
   });
   await refresh();
   setMessage(file.sharedWithKasa?
    'KASA access revoked. Any previously issued short-lived read link expires within 90 seconds.':
    'You have authorized KASA staff to view this document while your bucket stays connected.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to change KASA access.');}
  finally{setBusy(false);}
 }
 async function openFile(id:string){
  setError('');
  try{
   const file=files.find(f=>f.id===id);
   if(file?.connectionId==='oauth'){
    const headers=await authHeaders();
    const response=await fetch('/api/r2/oauth/files/'+encodeURIComponent(id)+'/content',{headers,cache:'no-store'});
    if(!response.ok){
     const problem=await response.json().catch(()=>({})) as {error?:string};
     throw Error(problem.error||'Unable to read your private document.');
    }
    const blob=await response.blob(),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=file.fileName;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
   }else{
    const url=await r2ReadUrl(id);window.open(url,'_blank','noopener,noreferrer');
   }
  }catch(e){setError(e instanceof Error?e.message:'Unable to open file.');}
 }
 return <section className="profile-section-card" aria-label="Cloudflare R2 storage">
  <h2><Cloud size={20}/> My private storage · Cloudflare R2</h2>
  <p>Upload photos and documents directly without visiting Cloudinary. KASA keeps file metadata in Firebase Firestore. A personal bucket remains yours; KASA never owns its contents.</p>
  {error&&<p className="alert-error" role="alert">{error}</p>}
  {message&&<p className="notice" role="status">{message}</p>}
  {administrator&&<div className="admin-edit-item" aria-label="Institutional storage configuration">
   <h3><ShieldCheck size={17}/> KASA institutional bucket status</h3>
   <p className="muted">Configuration names only — credentials are never shown or entered here. This does not change your personal bucket.</p>
   {adminStatus&&<p role="status">{adminStatus.platformConfigured
    ?'All four platform environment variables are present.'
    :'Institutional R2 is not yet configured; KASA uses its documented legacy storage fallback.'}</p>}
   {adminStatus&&adminStatus.missingVariables.length>0&&<div>
    <p className="muted">Missing Vercel environment variables:</p>
    <ul>{adminStatus.missingVariables.map(k=><li key={k}><code>{k}</code></li>)}</ul>
   </div>}
   {adminStatus&&adminStatus.platformConfigured&&<p className="muted">Connection check: {({
    ready:'R2 accepted the private-bucket read check.',
    rejected:'Cloudflare rejected the credentials or bucket access.',
    unreachable:'Cloudflare R2 is unreachable from the app.',
    invalid_configuration:'The account ID, bucket name or jurisdiction is invalid.',
    not_checked:'Not checked yet.',
    not_configured:'Configuration incomplete.'
   } as Record<AdminStatus['connectivity'],string>)[adminStatus.connectivity]}</p>}
   {statusError&&<p className="alert-error" role="alert">{statusError}</p>}
   <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
    <button type="button" className="btn btn-outline" disabled={checkingStatus} onClick={()=>void checkPlatform(true)}>
     {checkingStatus?'Checking…':'Refresh & test connection'}
    </button>
    <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer">Open Vercel settings</a>
    <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer">Open Cloudflare R2</a>
   </div>
   <p className="field-hint">In Vercel: Pamtech → kasa → Settings → Environment Variables. Add the required names for Production and Preview. Create a replacement scoped R2 API token if its Secret Access Key was lost. Redeploy after saving.</p>
  </div>}
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
  <p className="muted">Your files remain private until you choose to share a document with KASA. Authorized staff can view only approved documents, and you can revoke access. Previously issued links expire within 90 seconds.</p>
  <div style={{display:'grid',gap:8}}>
   {files.slice(0,40).map(file=><div key={file.id} style={{display:'flex',gap:12,justifyContent:'space-between',borderBottom:'1px solid #d9e6dd',padding:'8px 0',flexWrap:'wrap'}}>
    <div><b>{file.fileName}</b><div className="muted" style={{fontSize:12}}>{(file.byteSize/1024).toFixed(1)} KB · {file.purpose==='profile-photo'?'Profile image':'Private document'} · {file.sharedCount} shares</div></div>
    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
     <button className="btn btn-outline" disabled={busy} type="button" onClick={()=>void openFile(file.id)}><Link2 size={16}/> Open securely</button>
     {file.purpose==='personal-document'&&<button className="btn btn-outline" disabled={busy} type="button"
      onClick={()=>void grantKasaAccess(file)}>
      {file.sharedWithKasa?'Revoke KASA access':'Share with KASA'}
     </button>}
    </div>
   </div>)}
   {!files.length&&<p className="muted">No R2 files yet. Existing Cloudinary and Firebase documents remain available while migration is prepared.</p>}
  </div>
  <div style={{marginTop:20,borderTop:'1px solid #d9e6dd',paddingTop:15}}>
   <h3><Cloud size={17}/> Connect your own Cloudflare storage</h3>
   <p className="muted">Sign in directly with Cloudflare and authorize KASA once. You own your files and the storage billing. Only files you explicitly share are available to KASA staff.</p>
   {oauthError&&<p role="alert" className="alert-error">{oauthError}</p>}
   {!oauth.available&&<p className="muted">Cloudflare one-click connection is awaiting KASA&apos;s registered OAuth application. Ordinary users will not need account IDs or access keys once enabled.</p>}
   {oauth.available&&!oauth.connected&&<button className="btn btn-primary" type="button" disabled={oauthBusy} onClick={()=>void beginCloudflare()}>
    <Cloud size={17}/> {oauthBusy?'Connecting…':'Connect with Cloudflare'}
   </button>}
   {oauth.connected&&<div style={{display:'grid',gap:10,marginTop:12}}>
    <p role="status">{oauth.selectedBucket
      ?'Connected to your Cloudflare R2 bucket: '+oauth.selectedBucket.bucket
      :'Cloudflare authorized. KASA is discovering the available R2 buckets.'}</p>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
     {!oauth.selectedBucket&&<button type="button" className="btn btn-outline" disabled={oauthBusy}
      onClick={()=>void discoverCloudflareBuckets()}>{oauthBusy?'Finding buckets…':'Find my R2 bucket'}</button>}
     <button type="button" className="btn btn-outline" disabled={oauthBusy} onClick={()=>void disconnectCloudflare()}>Disconnect Cloudflare</button>
    </div>
    {!oauth.selectedBucket&&accounts.length>1&&<label className="field">Your Cloudflare account
     <select value={selectedAccount} onChange={e=>void accountSelected(e.target.value)}>
      <option value="">Choose an authorized Cloudflare account</option>
      {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
     </select>
    </label>}
    {!oauth.selectedBucket&&buckets.length>0&&<label className="field">Your R2 bucket
     <select value={selectedBucket} onChange={e=>setSelectedBucket(e.target.value)}>
      <option value="">Choose a bucket</option>
      {buckets.map(b=><option key={b.name} value={b.name}>{b.name}</option>)}
     </select>
    </label>}
    {!oauth.selectedBucket&&selectedBucket&&<button type="button" className="btn btn-primary"
     disabled={oauthBusy} onClick={()=>void selectCloudflareBucket()}>Use this bucket for KASA</button>}
    {oauth.selectedBucket&&<label className="btn btn-outline" style={{cursor:oauthBusy?'not-allowed':'pointer'}}>
     <FolderUp size={16}/> Upload to my Cloudflare bucket (max 3 MB)
     <input type="file" accept="image/png,image/jpeg,application/pdf" hidden disabled={oauthBusy}
      onChange={e=>{const file=e.target.files?.[0];if(file)void uploadCloudflare(file);e.target.value='';}}/>
    </label>}
   </div>}
  </div>
  <div style={{marginTop:20,borderTop:'1px solid #d9e6dd',paddingTop:15}}>
   <button type="button" className="btn btn-outline" onClick={()=>setShowAdvanced(x=>!x)}>
    {showAdvanced?'Hide technical connection settings':'Advanced: connect using R2 API credentials'}
   </button>
   {showAdvanced&&<div style={{marginTop:12}}>
   <h3><ShieldCheck size={17}/> Advanced bucket connection</h3>
   {!config.byobAvailable&&<p className="alert-error" role="status">KASA must configure its encrypted BYOB storage key before members can connect personal buckets. Existing uploads remain available.</p>}
   <p className="muted">In Cloudflare, create a private R2 bucket, issue an <strong>Object Read & Write</strong> token scoped only to that bucket, and configure bucket CORS for the KASA website origin and PUT Content-Type.</p>
   {config.connections.map(c=><div key={c.id} style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
    <span><b>{c.label}</b> · {c.bucket} · {c.status}</span>
    {c.status==='active'&&<button className="btn btn-outline" type="button" disabled={busy} onClick={()=>void disconnect(c)}><Trash2 size={15}/> Disconnect</button>}
   </div>)}
   <button type="button" className="btn btn-outline" disabled={!config.byobAvailable} onClick={()=>setShowConnect(x=>!x)}>{showConnect?<CloudOff size={16}/>:<Cloud size={16}/>} {showConnect?'Cancel connection':'Connect my R2 bucket'}</button>
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
  </div>}
  </div>
 </section>;
}
