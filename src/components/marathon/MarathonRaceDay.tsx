'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {authHeaders} from '@/lib/firebase-client';
import {LEGACY_MARATHON_EVENT_ID,type MarathonEvent} from '@/lib/marathon-event-model';
import {raceDayKinds,type RaceDayKind,type RaceDayEntry,type RaceDayStatus} from '@/lib/marathon-race-day';
import {ClipboardCheck,RefreshCcw,ShieldCheck,AlertTriangle,Plus,ArrowLeft} from 'lucide-react';
type Response={event:MarathonEvent;entries:RaceDayEntry[];canWrite:boolean;partial:boolean;
 summary:{total:number;ready:number;active:number;blocked:number;resolved:number}};
type EventResponse={events:MarathonEvent[]};
async function request<T>(url:string,init:RequestInit={}):Promise<T>{
 const headers=await authHeaders(),res=await fetch(url,{...init,cache:'no-store',headers:{...headers,...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}});
 const json=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(json.error||'Unable to load Marathon operations.');return json as T;
}
const kinds=Object.entries(raceDayKinds) as [RaceDayKind,string][];
const statuses:RaceDayStatus[]=['planned','ready','active','blocked','resolved'];
export function MarathonRaceDay(){
 const [events,setEvents]=useState<MarathonEvent[]>([]);
 const [eventId,setEventId]=useState(LEGACY_MARATHON_EVENT_ID);
 const [data,setData]=useState<Response|null>(null),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [form,setForm]=useState({kind:'water_station' as RaceDayKind,title:'',zone:'',note:''});
 const [adding,setAdding]=useState(false);
 const loadEvents=useCallback(async()=>{
  const r=await request<EventResponse>('/api/marathon/events');
  setEvents(r.events);
  const requested=new URLSearchParams(window.location.search).get('event');
  if(requested&&r.events.some(x=>x.id===requested))setEventId(requested);
 },[]);
 useEffect(()=>{void loadEvents().catch(e=>setError(e instanceof Error?e.message:'Unable to load events.'));},[loadEvents]);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{setData(await request<Response>('/api/marathon/race-day?event='+encodeURIComponent(eventId)));}
  catch(e){setError(e instanceof Error?e.message:'Unable to load race-day operations.');}
  finally{setLoading(false);}
 },[eventId]);
 useEffect(()=>{void load();},[load]);
 function choose(id:string){
  setEventId(id);setData(null);setNotice('');
  const url=new URL(window.location.href);url.searchParams.set('event',id);
  window.history.replaceState({},'',url.pathname+url.search);
 }
 async function create(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   await request('/api/marathon/race-day',{method:'POST',body:JSON.stringify({...form,eventId,status:'planned'})});
   setAdding(false);setForm({kind:'water_station',title:'',zone:'',note:''});setNotice('New checkpoint created.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Could not create checkpoint.');}
  finally{setBusy(false);}
 }
 async function changeStatus(item:RaceDayEntry,status:RaceDayStatus){
  setBusy(true);setError('');setNotice('');
  try{
   await request('/api/marathon/race-day',{method:'PATCH',body:JSON.stringify({
    id:item.id,eventId,expectedRevision:item.revision,changes:{status}
   })});
   setNotice('Checkpoint status saved.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Could not update checkpoint.');}
  finally{setBusy(false);}
 }
 const total=data?.summary;
 return <main className="ml-container" style={{maxWidth:1200,margin:'0 auto',padding:'24px 16px 60px',color:'var(--ink,#17392c)'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
   <div><h1>KASA Life Marathon — Race-day operations</h1>
    <p>Event-specific readiness and incident coordination. No individual medical data or participant check-ins are stored here.</p></div>
   <Link href="/marathon" className="btn btn-outline"><ArrowLeft size={16}/> Operations home</Link>
  </div>
  <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end',marginBottom:16}}>
   <div className="field" style={{flex:'1 1 270px'}}>
    <label htmlFor="race-event">Select marathon event</label>
    <select id="race-event" className="form-select" value={eventId} onChange={e=>choose(e.target.value)}>
     {events.map(e=><option key={e.id} value={e.id}>{e.name} — {e.eventDate}</option>)}
    </select>
   </div>
   <button type="button" className="btn btn-outline" disabled={loading||busy} onClick={()=>void load()}><RefreshCcw size={16}/> Refresh live desk</button>
   <Link href={'/marathon/budget?event='+encodeURIComponent(eventId)} className="btn btn-outline">Event budget</Link>
  </div>
  {error&&<p className="alert-error" role="alert">{error}</p>}
  {notice&&<p className="notice" role="status">{notice}</p>}
  {loading&&<p role="status">Loading event checkpoints…</p>}
  {data&&<><div className="metric-grid" style={{marginBottom:20}}>
   <div className="metric-card"><span>Operations checkpoints</span><strong>{total?.total||0}</strong></div>
   <div className="metric-card"><span>Ready</span><strong>{total?.ready||0}</strong></div>
   <div className="metric-card"><span>Active now</span><strong>{total?.active||0}</strong></div>
   <div className="metric-card"><span>Blocked / urgent</span><strong>{total?.blocked||0}</strong></div>
   <div className="metric-card"><span>Resolved</span><strong>{total?.resolved||0}</strong></div>
  </div>
  {data.partial&&<p className="notice">More than 250 checkpoints exist; this desk is showing a partial view. Ask the event administrator to reconcile.</p>}
  <section className="panel pad-panel" style={{marginBottom:20}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
    <div><h2><ClipboardCheck size={20}/> Checkpoints and team readiness</h2>
     <p>Each status update is stored with its editor, timestamp and previous revision.</p></div>
    {data.canWrite&&<button className="btn btn-primary" onClick={()=>setAdding(x=>!x)}><Plus size={16}/> {adding?'Close':'Add checkpoint'}</button>}
   </div>
   {!data.canWrite&&<p className="muted"><ShieldCheck size={15}/> Read-only: request an event operations editor role to update checkpoints.</p>}
   {adding&&data.canWrite&&<form onSubmit={e=>void create(e)} style={{padding:12,margin:'12px 0',border:'1px solid #d1d5db',borderRadius:8}}>
    <div className="form-grid">
     <div className="field"><label htmlFor="race-type">Operations area</label>
      <select id="race-type" className="form-select" value={form.kind} onChange={e=>setForm({...form,kind:e.target.value as RaceDayKind})}>
       {kinds.map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select>
     </div>
     <div className="field"><label htmlFor="race-zone">Zone / location</label>
      <input id="race-zone" required minLength={2} maxLength={80} placeholder="e.g., 10 km water point 2"
       value={form.zone} onChange={e=>setForm({...form,zone:e.target.value})}/></div>
     <div className="field"><label htmlFor="race-title">Task or incident title</label>
      <input id="race-title" required minLength={4} maxLength={100} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
     <div className="field"><label htmlFor="race-note">Operational notes (no private health details)</label>
      <textarea id="race-note" rows={2} maxLength={500} value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></div>
    </div>
    <button disabled={busy} type="submit" className="btn btn-primary">{busy?'Saving…':'Save checkpoint'}</button>
   </form>}
   <div className="table-scroll"><table className="data-table">
    <thead><tr><th>Area</th><th>Zone</th><th>Checkpoint</th><th>Status</th><th>Last update</th></tr></thead>
    <tbody>{data.entries.map(item=><tr key={item.id}>
     <td>{raceDayKinds[item.kind]}</td><td>{item.zone}</td><td><strong>{item.title}</strong><small style={{display:'block'}}>{item.note}</small></td>
     <td>{data.canWrite?<select aria-label={'Update '+item.title} disabled={busy} className="form-select" value={item.status}
      onChange={e=>void changeStatus(item,e.target.value as RaceDayStatus)}>
      {statuses.map(s=><option key={s} value={s}>{s}</option>)}</select>:item.status}</td>
     <td>{item.updatedAt?.slice(0,16).replace('T',' ')||'—'}</td>
    </tr>)}
    {!data.entries.length&&<tr><td colSpan={5}>No race-day checkpoints yet. Authorized staff can create a station or operational task.</td></tr>}
    </tbody></table></div>
  </section>
  <section className="panel pad-panel"><h2><AlertTriangle size={19}/> System integration status</h2>
   <p>Registration counts, individual bib collection, chip timing and runner QR check-ins are <strong>not connected to this board</strong>. This page does not invent runner counts or medical outcomes.</p>
   <p>Use the readiness log for teams and facilities now. Connect the future runner registry only after registration ownership, identity checks and idempotent scanning are approved.</p>
  </section>
  </>}
 </main>;
}
