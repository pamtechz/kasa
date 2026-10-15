'use client';
import {useEffect,useState} from 'react';
import {Bell} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
type Notice={id:string;event:string;title:string;message:string;reference:string;createdAt:string};
export default function Notifications(){
 const [items,setItems]=useState<Notice[]>([]),[error,setError]=useState('');
 useEffect(()=>{api<{notifications:Notice[]}>('/api/notifications').then(r=>setItems(r.notifications)).catch(e=>setError(e.message));},[]);
 return <><PageHeader title="Notifications" subtitle="Internal updates for admissions reviews, sponsorship decisions and commissions."/>
 {error&&<div className="alert-error">{error}</div>}
 <div className="panel pad-panel">{items.length?items.map(n=><div className="notification-item" key={n.id}><Bell size={19}/><div><strong>{n.title}</strong><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleString()} · {n.reference}</small></div></div>):<p className="muted">No notifications to display.</p>}</div></>;
}
