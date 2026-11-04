'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {authHeaders} from '@/lib/firebase-client';
import {LEGACY_MARATHON_EVENT_ID,type MarathonEvent,type BudgetLine} from '@/lib/marathon-event-model';
import styles from './MarathonEventBudget.module.css';
import {BudgetWorkbook,type BudgetResult} from './BudgetWorkbook';
import {budgetCsv,budgetClassifications,lineClassification} from '@/lib/marathon-budget-workbook';
import type {BudgetClassification} from '@/lib/marathon-event-model';

type Member={uid:string;email:string;displayName:string;role:string;active:boolean};
const money=(minor:number)=>new Intl.NumberFormat('en-ZM',{minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100);
async function request<T>(path:string,options:RequestInit={}):Promise<T>{
 const headers=await authHeaders();
 const response=await fetch(path,{...options,cache:'no-store',headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'Request failed.');
 return result as T;
}
const draftEvent={name:'',preparationStart:'',eventDate:'',
 closeoutDate:'',targetRunners:'',registrationFeeK:''};
const draftLine={category:'Administration',description:'',quantity:'1',unitCostK:'0',months:'1',
 taskId:'',startDate:'',endDate:'',notes:'',actualPaidK:'0',
 classification:'costed' as BudgetClassification,sourceOfFunds:'',dueDateText:''};
export function MarathonEventBudget({view}:{view:'events'|'budget'}){
 const [events,setEvents]=useState<MarathonEvent[]>([]);
 const [canCreate,setCanCreate]=useState(false),[members,setMembers]=useState<Member[]>([]);
 const [selected,setSelected]=useState(LEGACY_MARATHON_EVENT_ID);
 const [eventForm,setEventForm]=useState(draftEvent),[showEventForm,setShowEventForm]=useState(false);
 const [budget,setBudget]=useState<BudgetResult|null>(null),[lineForm,setLineForm]=useState(draftLine);
 const [editing,setEditing]=useState<BudgetLine|null>(null),[showLineForm,setShowLineForm]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const current=events.find(e=>e.id===selected);
 const budgetRequest=useRef(0);
 const [budgetLoading,setBudgetLoading]=useState(false);
 const [showSettings,setShowSettings]=useState(false);
 const [settings,setSettings]=useState({targetRunners:'',registrationFeeK:'',sponsorshipTargetK:''});
 const loadEvents=useCallback(async()=>{
  const answer=await request<{events:MarathonEvent[];canCreate:boolean}>('/api/marathon/events');
  setEvents(answer.events);setCanCreate(answer.canCreate);
  const fromUrl=new URLSearchParams(window.location.search).get('event');
  if(fromUrl&&answer.events.some(x=>x.id===fromUrl))setSelected(fromUrl);
 },[]);
 const loadBudget=useCallback(async(id:string)=>{
  const requestId=++budgetRequest.current;setBudget(previous=>previous?.event.id===id?previous:null);setBudgetLoading(true);
  try{const result=await request<BudgetResult>('/api/marathon/events/'+encodeURIComponent(id)+'/budget');if(requestId===budgetRequest.current)setBudget(result);}
  catch(e){if(requestId===budgetRequest.current)setError(e instanceof Error?e.message:'Budget access unavailable.');}
  finally{if(requestId===budgetRequest.current)setBudgetLoading(false);}
 },[]);
 useEffect(()=>{void loadEvents().catch(e=>setError(e.message));},[loadEvents]);
 useEffect(()=>{if(view==='budget')void loadBudget(selected);},[selected,view,loadBudget]);
 useEffect(()=>{if(!canCreate)return;
  void request<{members:Member[]}>('/api/marathon/bootstrap').then(r=>setMembers(r.members||[])).catch(()=>{});
 },[canCreate]);
 function choose(id:string){if(id!==selected){budgetRequest.current++;setBudget(null);setShowLineForm(false);setShowSettings(false);setEditing(null);}setSelected(id);setError('');setNotice('');
  const url=new URL(window.location.href);url.searchParams.set('event',id);
  window.history.replaceState(null,'',url.pathname+url.search);}
 async function execute(action:()=>Promise<void>,success:string){
  setBusy(true);setError('');setNotice('');
  try{await action();setNotice(success);await loadEvents();if(view==='budget')await loadBudget(selected);}
  catch(e){setError(e instanceof Error?e.message:'Unable to save changes.');}
  finally{setBusy(false);}
 }
 async function createEvent(){
  await execute(async()=>{
   if(!eventForm.targetRunners||!eventForm.registrationFeeK)throw Error('Enter the runner target and registration fee.');
   const data={...eventForm,targetRunners:Number(eventForm.targetRunners),registrationFeeMinor:Math.round(Number(eventForm.registrationFeeK)*100)};
   const {registrationFeeK,...payload}=data;void registrationFeeK;
   const result=await request<{event:MarathonEvent}>('/api/marathon/events',{method:'POST',body:JSON.stringify(payload)});
   choose(result.event.id);setShowEventForm(false);
  },'Event created. It has its own checklist and budget.');
 }
 async function setEventStatus(status:MarathonEvent['status']){
  if(!current)return;
  await execute(async()=>{
   await request('/api/marathon/events/'+current.id,{method:'PATCH',body:JSON.stringify({
    expectedRevision:current.revision,changes:{status}})});
  },'Event status updated.');
 }
 function editSettings(){
  if(!current)return;
  setSettings({targetRunners:String(current.targetRunners),registrationFeeK:String(current.registrationFeeMinor/100),sponsorshipTargetK:String((current.budgetSponsorshipTargetMinor||0)/100)});
  setShowSettings(true);
 }
 async function saveSettings(){
  if(!current)return;
  await execute(async()=>{
   if(Object.values(settings).some(x=>!x.trim()))throw Error('Enter all planning targets. Use zero if no sponsorship target is planned.');
   await request('/api/marathon/events/'+current.id,{method:'PATCH',body:JSON.stringify({expectedRevision:current.revision,changes:{
    targetRunners:Number(settings.targetRunners),registrationFeeMinor:Math.round(Number(settings.registrationFeeK)*100),
    budgetSponsorshipTargetMinor:Math.round(Number(settings.sponsorshipTargetK)*100)
   }})});
   setShowSettings(false);
  },'Event targets saved. Budget projections now use these values.');
 }
 async function toggleGrant(key:'adminUids'|'budgetEditorUids'|'budgetViewerUids'|'budgetApproverUids',uid:string){
  if(!current)return;
  await execute(async()=>{
   const list=current[key].includes(uid)?current[key].filter(x=>x!==uid):[...current[key],uid];
   await request('/api/marathon/events/'+current.id,{method:'PATCH',body:JSON.stringify({
    expectedRevision:current.revision,changes:{[key]:list}})});
  },'Event permission updated.');
 }
 function editLine(line?:BudgetLine){
  setEditing(line||null);
  setLineForm(line?{
   category:line.category,description:line.description,quantity:String(line.quantity),
   unitCostK:String((lineClassification(line)==='costed'?line.unitCostMinor:(line.reportedEstimateMinor||0)/line.quantity/line.months)/100),months:String(line.months),
   classification:lineClassification(line),sourceOfFunds:line.sourceOfFunds||'',dueDateText:line.dueDateText||'',
   taskId:line.taskId||'',startDate:line.startDate||'',endDate:line.endDate||'',
   notes:line.notes,actualPaidK:String(line.actualPaidMinor/100)}:draftLine);
  setShowLineForm(true);
  requestAnimationFrame(()=>document.getElementById('budget-item-form')?.scrollIntoView({behavior:'instant',block:'start'}));
  requestAnimationFrame(()=>document.getElementById('budget-item-description')?.focus({preventScroll:true}));
 }
 async function saveLine(){
  await execute(async()=>{
   const quantity=Number(lineForm.quantity),months=Number(lineForm.months);
   const unitCostMinor=Math.round(Number(lineForm.unitCostK)*100);
   if(!Number.isInteger(quantity)||quantity<1||!Number.isInteger(months)||months<1||
     !Number.isFinite(unitCostMinor)||unitCostMinor<0)throw Error('Check quantity, months and cost.');
   const payload={category:lineForm.category,description:lineForm.description,quantity,months,
    unitCostMinor,classification:lineForm.classification,sourceOfFunds:lineForm.sourceOfFunds,dueDateText:lineForm.dueDateText,taskId:lineForm.taskId||null,startDate:lineForm.startDate||null,endDate:lineForm.endDate||null,notes:lineForm.notes};
   if(editing){
    await request('/api/marathon/events/'+selected+'/budget/'+editing.id,{
     method:'PATCH',body:JSON.stringify({expectedRevision:editing.revision,changes:payload})});
   }else{
    await request('/api/marathon/events/'+selected+'/budget',{method:'POST',body:JSON.stringify(payload)});
   }
   setShowLineForm(false);setEditing(null);
  },'Budget line saved.');
 }
 async function updateLine(line:BudgetLine,status:BudgetLine['status']){
  const entered=status==='paid'?window.prompt('Actual paid amount (K)',String(line.actualPaidMinor/100)):null;
  if(status==='paid'&&entered===null)return;
  await execute(async()=>{
   const amount=status==='paid'?Math.round(Number(entered)*100):line.actualPaidMinor;
   if(!Number.isInteger(amount)||amount<0)throw Error('Invalid payment amount.');
   await request('/api/marathon/events/'+selected+'/budget/'+line.id,{method:'PATCH',body:JSON.stringify({
    expectedRevision:line.revision,changes:status==='paid'?{status,actualPaidMinor:amount}:{status}
   })});
  },'Budget line updated.');
 }
 function exportCsv(){
  if(!budget)return;
  const csv=budgetCsv(budget.lines);
  const href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=href;anchor.download=selected+'-budget.csv';anchor.click();
  URL.revokeObjectURL(href);
 }
 return <main className={styles.page}><div className={styles.container}>
  <header className={styles.top}><div><h1>KASA Life Marathon — {view==='events'?'Event Management':'Event Budget'}</h1>
   <span className={styles.hint}>Secure event-scoped planning · All financial amounts in ZMW</span></div>
   <nav className={styles.links} aria-label="Marathon features">
    <Link href="/marathon">Command Center</Link><Link href="/marathon/events">Events</Link>
    <Link href={'/marathon/budget?event='+selected}>Budget</Link><Link href={'/marathon/operations?event='+selected}>Checklist</Link>
   </nav></header>
  {error&&<div role="alert" className={styles.error}>{error}</div>}
  {notice&&<div role="status" className={styles.notice}>{notice}</div>}
  <section className={styles.panel}><h2>Select an event</h2>
   <div className={styles.grid}>{events.map(event=><button key={event.id} className={styles.event}
    aria-current={event.id===selected} disabled={busy} onClick={()=>choose(event.id)}>
    <strong>{event.name}</strong><span className={styles.badge}>{event.status}</span>
    <div className={styles.hint}>{event.preparationStart} – {event.closeoutDate} · Race {event.eventDate}</div>
   </button>)}</div>
   {canCreate&&<div className={styles.actions}><button className={styles.button} onClick={()=>setShowEventForm(x=>!x)}>Create another event</button></div>}
  </section>
  {showEventForm&&canCreate&&<section className={styles.panel}><h2>New independent event</h2>
   <div className={styles.grid}>
    {(['name','preparationStart','eventDate','closeoutDate','targetRunners','registrationFeeK'] as const).map(key=>
     <label className={styles.field} key={key}>{key==='registrationFeeK'?'Registration fee (K)':key.replaceAll(/([A-Z])/g,' $1')}
      <input type={key.toLowerCase().includes('date')||key==='preparationStart'||key==='closeoutDate'?'date':key==='targetRunners'||key==='registrationFeeK'?'number':'text'}
       value={eventForm[key]} onChange={e=>setEventForm(x=>({...x,[key]:e.target.value}))}/>
     </label>)}
   </div><div className={styles.actions}><button className={styles.button} disabled={busy} onClick={()=>void createEvent()}>Save event</button></div>
  </section>}
  {view==='events'&&current&&<section className={styles.panel}><h2>{current.name}</h2>
   <div className={styles.metrics}>
    <div className={styles.metric}><small>Race date</small><b>{current.eventDate}</b></div>
    <div className={styles.metric}><small>Target runners</small><b>{current.targetRunners.toLocaleString()}</b></div>
    <div className={styles.metric}><small>Registration fee</small><b>K{money(current.registrationFeeMinor)}</b></div>
    <div className={styles.metric}><small>Event status</small><b>{current.status}</b></div>
   </div>
   {canCreate&&<div className={styles.actions}>
    <button className={styles.button} disabled={busy} onClick={editSettings}>Edit planning targets</button>
    {(['planning','active','completed','archived','cancelled'] as const).map(status=>
     <button key={status} disabled={busy||current.status===status} className={styles.button+' '+styles.secondary}
      onClick={()=>void setEventStatus(status)}>{status}</button>)}
   </div>}
   {showSettings&&canCreate&&<form onSubmit={e=>{e.preventDefault();void saveSettings();}}><h3>Planning targets</h3><div className={styles.grid}>
    {(['targetRunners','registrationFeeK','sponsorshipTargetK'] as const).map(key=><label className={styles.field} key={key}>{{targetRunners:'Runner target',registrationFeeK:'Registration fee (K)',sponsorshipTargetK:'Sponsorship target (K, unconfirmed)'}[key]}
     <input type="number" required min={key==='targetRunners'?1:0} step={key==='targetRunners'?1:'0.01'} value={settings[key]} onChange={e=>setSettings(x=>({...x,[key]:e.target.value}))}/></label>)}
    </div><div className={styles.actions}><button type="submit" className={styles.button} disabled={busy}>Save targets</button><button type="button" className={styles.button+' '+styles.secondary} onClick={()=>setShowSettings(false)}>Cancel</button></div></form>}
  </section>}
  {view==='events'&&current&&<section className={styles.panel}>
   <h2>Event-specific team permissions</h2><p className={styles.hint}>Only the School super administrator may grant or revoke assignments. An assigned user must also have an active Marathon account and an eligible role.</p>
   {canCreate?<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Member</th><th>Event admin</th><th>Budget editor</th><th>Budget approver</th><th>Budget viewer</th></tr></thead>
    <tbody>{members.filter(m=>m.active).map(member=><tr key={member.uid}><td>{member.displayName||member.email}<br/><small>{member.role}</small></td>
     {(['adminUids','budgetEditorUids','budgetApproverUids','budgetViewerUids'] as const).map(key=><td key={key}>
      <label><input type="checkbox" checked={current[key].includes(member.uid)} disabled={busy||member.role==='kasaClient'&&key!=='budgetViewerUids'}
       onChange={()=>void toggleGrant(key,member.uid)}/> Assigned</label></td>)}
    </tr>)}</tbody></table></div>:<p>Ask the School super administrator to manage this event&apos;s assignments.</p>}
   <p className={styles.hint}>Budget access and approval permissions are separate from School finance and do not affect KASA School roles.</p>
  </section>}
  {view==='budget'&&showLineForm&&budget?.permissions.write&&<section id="budget-item-form" className={styles.panel}><h2>{editing?'Edit':'Add'} budget item</h2>
   <div className={styles.grid}>
    {(['description','category','quantity','unitCostK','months','sourceOfFunds','dueDateText','taskId','startDate','endDate'] as const).map(key=>
     <label className={styles.field} key={key}>{{description:'Item description',category:'Category',quantity:'Quantity',unitCostK:'Unit cost / estimate (K)',months:'Periods (months)',sourceOfFunds:'Funding source',dueDateText:'Payment due / schedule',taskId:'Linked activity ID',startDate:'Activity start',endDate:'Activity end'}[key]}
      <input id={key==='description'?'budget-item-description':undefined} type={['quantity','unitCostK','months'].includes(key)?'number':key.toLowerCase().includes('date')?'date':'text'}
       step={key==='unitCostK'?'0.01':undefined} value={lineForm[key]}
       onChange={e=>setLineForm(x=>({...x,[key]:e.target.value}))}/>
     </label>)}
    <label className={styles.field}>Cost treatment<select value={lineForm.classification} onChange={e=>setLineForm(x=>({...x,classification:e.target.value as BudgetClassification}))}>{Object.entries(budgetClassifications).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
    <label className={styles.field}>Notes<textarea value={lineForm.notes} onChange={e=>setLineForm(x=>({...x,notes:e.target.value}))}/></label>
   </div><p className={styles.hint}>Only Costed items increase the cash budget. Other treatments retain their estimate without adding a second allocation. Change an item to Costed when its quotation is agreed.</p><p className={styles.hint}>Linked activity is optional. Enter an activity ID from this event; the server verifies that it belongs to the same event.</p>
   <div className={styles.actions}><button className={styles.button} disabled={busy} onClick={()=>void saveLine()}>Save budget item</button>
    <button className={styles.button+' '+styles.secondary} onClick={()=>setShowLineForm(false)}>Cancel</button></div>
  </section>}
  {view==='budget'&&budget&&<BudgetWorkbook key={budget.event.id} budget={budget} busy={busy} onAdd={()=>editLine()} onEdit={editLine} onUpdate={(line,status)=>void updateLine(line,status)} onExport={exportCsv}/>}
  {view==='budget'&&!budget&&<section className={styles.panel} aria-live="polite">{budgetLoading?'Loading the event budget…':<>Budget information could not be loaded. <button className={styles.button} onClick={()=>{setError('');void loadBudget(selected);}}>Try again</button></>}</section>}
 </div></main>;
}
