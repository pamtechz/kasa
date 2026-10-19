'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Database,CheckCircle2,ExternalLink,ShieldCheck} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {ConfirmModal} from '@/components/ConfirmModal';
type Result={programmes:number;announcements:number;forms:number;settings:number;skipped:number};
type SetupStatus={database:string;collections:Record<string,boolean>;intakeOpen:boolean};
export default function Setup(){
 const [result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [status,setStatus]=useState<SetupStatus|null>(null),[statusLoading,setStatusLoading]=useState(true);
 const [confirmSeed,setConfirmSeed]=useState(false);
 async function check(){
  setStatusLoading(true);
  try{setStatus(await api<SetupStatus>('/api/admin/setup/status'));}
  catch(e){setError(e instanceof Error?e.message:'Unable to check Firestore.');}
  finally{setStatusLoading(false);}
 }
 useEffect(()=>{void check();},[]);
 async function executeSeed(){
  setBusy(true);setError('');
  try{const response=await api<{results:Result}>('/api/admin/seed',{method:'POST'});setResult(response.results);await check();}
  catch(e){setError(e instanceof Error?e.message:'Unable to seed Firestore.');}finally{setBusy(false);setConfirmSeed(false);}
 }
 return <><PageHeader title="Initial setup and data" subtitle="Initialize missing KASA reference records and complete the institution's go-live checklist."/>
 <div className="settings-grid"><section className="panel pad-panel">
  <div className="metric-icon green"><Database/></div><h2>Firebase database readiness</h2>
  {statusLoading?<p className="muted">Checking Firestore…</p>:status?<><p className="notice">Firestore responds to authenticated administrator requests. Public application opening remains controlled separately by the intake policy.</p>
   <div className="setup-collection-grid">{Object.entries(status.collections).map(([name,exists])=><div key={name} className="setup-collection-item"><strong>{name.replaceAll('_',' ')}</strong><span className={exists?'setup-detected':'setup-missing'}>{exists?'Data found':'Not initialized'}</span></div>)}</div>
   <p className="muted">Public admission window: <strong>{status.intakeOpen?'Enabled in Firestore':'Closed or not configured'}</strong></p>
  </>:<p className="muted">Firebase status could not be loaded. Check the authorization, configuration and server logs.</p>}
  <button className="btn btn-outline" onClick={()=>void check()} disabled={statusLoading}>Recheck database status</button>
  <h2>Seed Firestore starter data</h2>
  <p>Firebase variables alone do not insert database records. Sign in as the verified super administrator and run this one-time, non-destructive operation. It creates KASA&apos;s 2027 draft forms, course catalogue, proposed fees, initial announcements, website contacts and a <strong>closed</strong> admissions policy. Existing documents are preserved. A super-administrator must approve the seed. All application forms remain drafts until reviewed and published.</p>
  <button className="btn btn-primary" disabled={busy} onClick={()=>setConfirmSeed(true)}>{busy?'Seeding…':'Seed missing Firestore records'}</button>
  {error&&<p className="alert-error">{error}</p>}
  {result&&<div className="notice"><CheckCircle2 size={16}/> Created {result.programmes} programmes, {result.announcements} announcements, {result.forms} form templates and {result.settings} settings records; skipped {result.skipped} existing records.</div>}
  <h2>After seeding</h2><ol><li><Link href="/dashboard/programmes">Review programmes and fees</Link>; distinguish proposed fees and external-award status.</li><li><Link href="/dashboard/announcements">Review and publish announcements</Link>.</li><li><Link href="/dashboard/forms">Customize and publish application templates</Link>.</li><li><Link href="/dashboard/intake">Set CDF documentation requirements, opening and closing dates</Link>.</li><li>Test student and agent login, uploads, acceptance-letter PDF and funding verification before public opening.</li></ol>
 </section><aside className="panel pad-panel"><ShieldCheck size={32}/><h3>First administrator</h3><p>If no super-administrator has been created, use the verified-email one-time secure bootstrap.</p><Link className="text-link" href="/bootstrap">Administrator bootstrap instructions <ExternalLink size={16}/></Link><p>Alternatively, <a href="https://github.com/pamtechz/kasa/blob/main/scripts/bootstrap-admin.mjs" target="_blank" rel="noreferrer">use the repository script</a> with your own server-side Firebase credentials.</p><p>Bootstrap is protected by Firebase email verification and the nominated email saved privately in Vercel.</p></aside></div>
<ConfirmModal
 isOpen={confirmSeed}
 title="Seed Starter Data"
 message="Add missing KASA programme, proposed fee and announcement records from the supplied reference documents? Existing records will not be overwritten."
 kind="info"
 confirmLabel="Seed Firestore Records"
 cancelLabel="Cancel"
 busy={busy}
 onConfirm={()=>void executeSeed()}
 onCancel={()=>setConfirmSeed(false)}
/>
</>;
}
