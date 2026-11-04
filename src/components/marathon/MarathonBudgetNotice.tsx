'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Bell,X} from 'lucide-react';
import {authHeaders} from '@/lib/firebase-client';
type Notice={id:string;title:string;message:string;createdAt:string};
export function MarathonBudgetNotice({eventId,memberUid}:{eventId:string;memberUid?:string}){
 const [data,setData]=useState<{notices:Notice[];canOpenBudget:boolean}>({notices:[],canOpenBudget:false});
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;setData({notices:[],canOpenBudget:false});
  void (async()=>{try{
   const headers=await authHeaders();const response=await fetch('/api/marathon/events/'+encodeURIComponent(eventId)+'/notices',{headers,cache:'no-store'});
   if(!response.ok)return;
   const next=await response.json();if(active)setData(next);
  }catch{/* The main workspace reports authentication/network errors. */}})();
  return ()=>{active=false;};
 },[eventId,memberUid]);
 async function dismiss(id:string){
  setBusy(true);setError('');
  try{const headers=await authHeaders();const response=await fetch('/api/marathon/events/'+encodeURIComponent(eventId)+'/notices',{
   method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id})});
   if(!response.ok)throw Error('The notice could not be dismissed. Try again.');
   setData(x=>({...x,notices:x.notices.filter(n=>n.id!==id)}));
  }catch(e){setError(e instanceof Error?e.message:'Unable to dismiss the notice.');}finally{setBusy(false);}
 }
 if(!data.notices.length)return null;
 return <section aria-label="Marathon notifications" style={{margin:'0 0 18px',border:'1px solid #9dc9ab',borderRadius:10,background:'#edf8f0',padding:16,color:'#173f28'}}>
  {data.notices.map(notice=><div key={notice.id} style={{display:'flex',gap:12,alignItems:'start'}}>
   <Bell size={20} style={{flexShrink:0,marginTop:3}} aria-hidden="true"/>
   <div style={{flex:1}}><strong>{notice.title}</strong><p style={{fontSize:14,margin:'5px 0 8px'}}>{notice.message}</p>
    {data.canOpenBudget?<Link href={'/marathon/budget?event='+encodeURIComponent(eventId)} style={{color:'#145e34',fontWeight:600,textDecoration:'underline'}}>Open draft budget</Link>:<small>Ask the event administrator for budget viewing access.</small>}
   </div><button type="button" disabled={busy} onClick={()=>void dismiss(notice.id)} aria-label={'Dismiss '+notice.title} style={{border:0,background:'transparent',color:'inherit',padding:6,cursor:'pointer'}}><X size={18}/></button>
  </div>)}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
