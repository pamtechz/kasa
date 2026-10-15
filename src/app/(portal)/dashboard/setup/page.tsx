'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Database,CheckCircle2,ExternalLink,ShieldCheck} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
type Result={programmes:number;announcements:number;forms:number;settings:number;skipped:number};
export default function Setup(){
 const [result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function seed(){
  if(!window.confirm('Add missing KASA programme, proposed fee and announcement records from the supplied reference documents? Existing records will not be overwritten.'))return;
  setBusy(true);setError('');
  try{const response=await api<{results:Result}>('/api/admin/seed',{method:'POST'});setResult(response.results);}
  catch(e){setError(e instanceof Error?e.message:'Unable to seed Firestore.');}finally{setBusy(false);}
 }
 return <><PageHeader title="Initial setup and data" subtitle="Initialize missing KASA reference records and complete the institution's go-live checklist."/>
 <div className="settings-grid"><section className="panel pad-panel">
  <div className="metric-icon green"><Database/></div><h2>Seed Firestore starter data</h2>
  <p>This operation creates KASA's 2027 draft forms, course catalogue, proposed fees, initial announcements, website contacts and a <strong>closed</strong> admissions policy. Existing documents are preserved. A super-administrator must approve the seed.</p>
  <button className="btn btn-primary" disabled={busy} onClick={()=>void seed()}>{busy?'Seeding…':'Seed missing Firestore records'}</button>
  {error&&<p className="alert-error">{error}</p>}
  {result&&<div className="notice"><CheckCircle2 size={16}/> Created {result.programmes} programmes, {result.announcements} announcements, {result.forms} form templates and {result.settings} settings records; skipped {result.skipped} existing records.</div>}
  <h2>After seeding</h2><ol><li><Link href="/dashboard/programmes">Review programmes and fees</Link>; distinguish proposed fees and external-award status.</li><li><Link href="/dashboard/announcements">Review and publish announcements</Link>.</li><li><Link href="/dashboard/forms">Customize and publish application templates</Link>.</li><li><Link href="/dashboard/intake">Set CDF documentation requirements, opening and closing dates</Link>.</li><li>Test student and agent login, uploads, acceptance-letter PDF and funding verification before public opening.</li></ol>
 </section><aside className="panel pad-panel"><ShieldCheck size={32}/><h3>First administrator</h3><p>If no super-administrator has been created, use the verified-email one-time secure bootstrap.</p><Link className="text-link" href="/bootstrap">Administrator bootstrap instructions <ExternalLink size={16}/></Link><p>Alternatively, <a href="https://github.com/pamtechz/kasa/blob/main/scripts/bootstrap-admin.mjs" target="_blank" rel="noreferrer">use the repository script</a> with your own server-side Firebase credentials.</p><p>Bootstrap is protected by Firebase email verification and the nominated email saved privately in Vercel.</p></aside></div></>;
}
