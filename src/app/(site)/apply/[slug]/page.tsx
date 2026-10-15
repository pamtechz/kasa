'use client';
import {useEffect,useState} from 'react';
import {useParams,useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {DynamicForm} from '@/components/DynamicForm';
import type {FormSchema} from '@/lib/types';
export default function Apply(){
 const {slug}=useParams<{slug:string}>();const search=useSearchParams();
 const [form,setForm]=useState<FormSchema|null>(null);const [error,setError]=useState('');
 useEffect(()=>{fetch(`/api/public/forms/${encodeURIComponent(slug)}`,{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setForm(d.form);}).catch(e=>setError(e.message));},[slug]);
 return <div className="application-page"><div className="apply-nav container"><Link href="/" className="brand"><span className="brand-mark">K</span><span><strong>KASA</strong><small>Official applications</small></span></Link><Link href="/">← Back to website</Link></div><main className="application-wrap">{error?<div className="form-panel"><h2>Form unavailable</h2><p>{error}</p><Link href="/">Return home</Link></div>:form?<DynamicForm form={form} agentCode={search.get('agent')||undefined}/>:<div className="form-panel">Loading application…</div>}</main><footer className="apply-footer">© {new Date().getFullYear()} KASA · Enrollment Network</footer></div>;
}
