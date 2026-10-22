'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {CheckCircle2,ShieldCheck,AlertTriangle,ArrowLeft,RefreshCw} from 'lucide-react';
import {SiteChrome} from '@/components/SiteChrome';

type PublicOfferResult={verified:boolean;reference:string;message:string};

export default function VerifyReferencePage(){
  const params=useParams<{reference:string}>();
  const reference=String(params?.reference||'').toUpperCase();
  const [loading,setLoading]=useState(true);
  const [record,setRecord]=useState<PublicOfferResult|null>(null);
  const [error,setError]=useState('');

  useEffect(()=>{
    let cancelled=false;
    async function check(){
      setLoading(true);setError('');setRecord(null);
      try{
        const response=await fetch('/api/public/verify/'+encodeURIComponent(reference),{cache:'no-store'});
        const data=await response.json();
        if(cancelled)return;
        if(response.status===429){
          setError('Too many verification checks. Please try again later.');
        }else if(response.ok && data?.verified===true){
          setRecord({verified:true,reference:String(data.reference||reference),message:String(data.message||'Official offer verified.')});
        }else{
          setError('No issued KASA admission offer could be verified for this reference.');
        }
      }catch{
        if(!cancelled)setError('Unable to verify the reference. Please try again.');
      }finally{
        if(!cancelled)setLoading(false);
      }
    }
    if(reference)void check();
    else{setLoading(false);setError('A reference is required.');}
    return ()=>{cancelled=true;};
  },[reference]);

  return <SiteChrome><main style={{background:'#f4f8f6',minHeight:'80vh',padding:'40px 20px'}}>
    <div style={{maxWidth:720,margin:'0 auto'}}>
      <Link href="/" className="text-link" style={{display:'inline-flex',gap:8,alignItems:'center',marginBottom:20}}>
        <ArrowLeft size={16}/> Back to KASA
      </Link>
      <div className="site-card" style={{padding:32,background:'#fff',borderRadius:16}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <ShieldCheck size={40} color="var(--green)"/>
          <h1 style={{fontSize:24,marginTop:12}}>Official Admission Offer Verification</h1>
          <p className="muted">Reference: <strong>{reference}</strong></p>
        </div>
        {loading?<p role="status" style={{textAlign:'center'}}><RefreshCw size={18}/> Checking official records…</p>:
          record?<div role="status" style={{padding:18,border:'1px solid var(--border)',borderRadius:10}}>
            <h2 style={{display:'flex',alignItems:'center',gap:8,fontSize:18,color:'var(--green)'}}>
              <CheckCircle2 size={20}/> Offer recorded
            </h2>
            <p>{record.message}</p>
          </div>:<div role="alert" className="alert-error" style={{display:'flex',alignItems:'center',gap:10}}>
            <AlertTriangle size={20}/>{error}
          </div>}
        <p className="muted" style={{fontSize:13,marginTop:20}}>
          Public verification confirms the existence of an issued offer only. It does not disclose applicant identities,
          funding arrangements or application progress. To confirm the identity on a presented document,
          contact KASA Admissions through the official institutional channels.
        </p>
        <p style={{fontSize:13}}>Applicants can access their own records from the <Link href="/my-applications" className="text-link">student portal</Link>.</p>
      </div>
    </div>
  </main></SiteChrome>;
}
