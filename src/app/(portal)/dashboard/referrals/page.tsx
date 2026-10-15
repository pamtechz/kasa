'use client';
import {useEffect,useState} from 'react';
import {Copy,Share2,Users,Wallet} from 'lucide-react';
import {api,PageHeader,StatusBadge} from '@/components/Portal';
type Referral={id:string;reference:string;submittedAt:string;status:string;commission?:{amount:number;currency:string;trigger:string;paidAt:string|null}|null};
type FormInfo={slug:string;title:string};
type ReferralResponse={agent:{agentCode:string;district:string};forms:FormInfo[];referrals:Referral[]};
export default function MyReferrals(){
 const [data,setData]=useState<ReferralResponse|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{api<ReferralResponse>('/api/agent/referrals').then(setData).catch(e=>setError(e.message));},[]);
 const total=data?.referrals.reduce((n,r)=>n+Number(r.commission?.amount||0),0)||0;
 const paid=data?.referrals.reduce((n,r)=>n+(r.commission?.paidAt?Number(r.commission.amount):0),0)||0;
 async function copy(slug:string){
  const url=new URL('/apply/'+slug,window.location.origin);
  url.searchParams.set('ref',data?.agent.agentCode||'');
  await navigator.clipboard.writeText(url.toString());
  setNotice('Referral link copied. Students can use this link to apply directly through KASA.');
 }
 return <><PageHeader title="My referrals" subtitle="Share your assigned link and track the status of attributed student applications."/>
 {error&&<div className="alert-error">{error}</div>}{notice&&<div className="notice">{notice}</div>}
 {data&&<><div className="metric-grid"><div className="metric-card"><div className="metric-icon green"><Users/></div><span>Total referrals</span><strong>{data.referrals.length}</strong></div>
 <div className="metric-card"><div className="metric-icon amber"><Wallet/></div><span>Eligible commissions</span><strong>K{total.toFixed(2)}</strong></div>
 <div className="metric-card"><div className="metric-icon green"><Wallet/></div><span>Payments recorded</span><strong>K{paid.toFixed(2)}</strong></div></div>
 <div className="panel pad-panel"><h2>Referral sharing</h2><p className="muted">Your code: <strong>{data.agent.agentCode}</strong> · Assigned district: {data.agent.district}</p>
 {data.forms.length?data.forms.map(f=><div className="inline-form" key={f.slug}><span>{f.title}</span><button className="btn btn-outline" onClick={()=>void copy(f.slug)}><Copy size={16}/> Copy referral link</button></div>):<p>Enrollment links will be available when KASA publishes a student application form.</p>}
 <p className="muted">A referral does not guarantee admission, CDF sponsorship or a commission. KASA must verify the eligible funding event and payment record.</p></div>
 <div className="panel"><div className="panel-title"><div><h2>My student applications</h2><p>Private applicant details are not shown in this referral overview.</p></div><Share2/></div>
 <div className="table-scroll"><table className="data-table"><thead><tr><th>Reference</th><th>Submitted</th><th>Status</th><th>Commission</th></tr></thead><tbody>{data.referrals.map(r=><tr key={r.id}><td><strong>{r.reference}</strong></td><td>{new Date(r.submittedAt).toLocaleDateString()}</td><td><StatusBadge status={r.status}/></td><td>{r.commission?'K'+r.commission.amount.toFixed(2)+(r.commission.paidAt?' · Paid':' · Pending'):'Not eligible yet'}</td></tr>)}{!data.referrals.length&&<tr><td colSpan={4} className="empty-state">No attributed student applications yet.</td></tr>}</tbody></table></div></div></>}
 </>;
}
