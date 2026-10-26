'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {MarathonLink as Link} from './MarathonLink';
import {SidebarScrollControls} from '@/components/SidebarScrollControls';
import {useRouter,usePathname,useSearchParams} from 'next/navigation';
import {onAuthStateChanged} from 'firebase/auth';
import {
 Activity,ArrowDownRight,ArrowRight,ArrowUpRight,Bell,CalendarDays,Check,CheckCheck,CheckCircle2,
 ChevronDown,ChevronLeft,ChevronRight,Circle,ClipboardCheck,Clock3,Cloud,CloudOff,
 Download,Eye,Filter,Flag,LayoutDashboard,Layers3,LogOut,Menu,MessageSquarePlus,
 MoreHorizontal,Plus,RefreshCcw,Search,Settings2,Shield,ShieldCheck,SlidersHorizontal,
 Sparkles,Target,Trash2,TrendingUp,UserPlus,Users,WifiOff,X,AlertTriangle
} from 'lucide-react';
import {authHeaders,getClientAuth,signOutClient} from '@/lib/firebase-client';
import {
 readMarathonCache,saveMarathonCache,pendingMarathonEdits,queueMarathonEdit,
 claimMarathonEdit,acknowledgeMarathonEdit,handleMarathonSyncFailure,resolveMarathonEdit
} from '@/lib/marathon-offline';
import type {PendingEdit} from '@/lib/marathon-offline';
import {csvEscape,schoolWorkspace} from '@/lib/marathon-export';
import {MarathonSyncReview} from './MarathonSyncReview';
import {MarathonSeedImport} from './MarathonSeedImport';
import {MarathonCategoryBoard} from './MarathonCategoryBoard';
import {MarathonAlertCenter} from './MarathonAlertCenter';
import {MarathonQuickViews} from './MarathonQuickViews';
import {marathonCategories,categoryForSection,categoryForId,isMarathonCategoryId,isMarathonCategorySection,groupMarathonCategories,matchesMarathonFilters,marathonToday,marathonFocusCounts} from '@/lib/marathon-categories';
import type {MarathonFocus} from '@/lib/marathon-categories';
import type {MarathonSeedInfo} from '@/lib/marathon-seed-import';
import type {MarathonTask,MarathonRole,MarathonStatus} from '@/lib/marathon-types';
import {marathonViewForPath} from '@/lib/marathon-navigation';
import type {MarathonView as View} from '@/lib/marathon-navigation';

type Identity={uid:string;email:string;displayName:string;schoolRole:string;role:MarathonRole};
type Suggestion={id:string;taskId:string;recommendation:string;proposedStatus?:MarathonStatus;status:string;createdBy:string;createdName:string;createdAt:string};
type Member={uid:string;email:string;displayName:string;schoolRole:string;role:MarathonRole;schoolActive:boolean;marathonActive:boolean;active:boolean};
type EventItem={id:string;action:string;actor:string;at:string;taskId?:string;targetUid?:string;changes?:Record<string,unknown>};
type Permissions={edit:boolean;review:boolean;manage:boolean;super:boolean};
type Bootstrap={source?:MarathonSeedInfo;identity:Identity;tasks:MarathonTask[];meta:Record<string,unknown>|null;suggestions:Suggestion[];nextSuggestionCursor?:string|null;members:Member[];permissions:Permissions};
type EditChanges=Partial<Pick<MarathonTask,'title'|'lead'|'section'|'dueDate'|'priority'|'importance'|'status'|'nextStep'|'notes'|'evidence'|'completedAt'|'archived'>>;
const blank:Bootstrap={identity:{uid:'',email:'',displayName:'',schoolRole:'student',role:'kasaClient'},tasks:[],meta:null,suggestions:[],members:[],permissions:{edit:false,review:false,manage:false,super:false}};
const statusLabels:Record<MarathonStatus,string>={todo:'Not started',doing:'In progress',blocked:'Blocked',done:'Completed'};
const roles=['kasaAdmin','kasaOperations','kasaEditor','kasaReviewer','kasaClient'] as const;
const nav=[{view:'overview' as View,label:'Home',icon:LayoutDashboard},{view:'operations' as View,label:'Checklist',icon:ClipboardCheck},{view:'categories' as View,label:'Categories',icon:Layers3},
 {view:'timeline' as View,label:'Timeline',icon:CalendarDays},{view:'recommendations' as View,label:'Recommendations',icon:MessageSquarePlus},
 {view:'activity' as View,label:'Activity log',icon:Activity},{view:'archive' as View,label:'Archive & recovery',icon:Trash2},{view:'settings' as View,label:'Settings & roles',icon:Settings2},
 {view:'sync' as View,label:'Offline edits',icon:CloudOff},
 {view:'super' as View,label:'Super admin',icon:ShieldCheck}];
function formatDate(value:string|null|undefined){if(!value)return 'Not set';const date=new Date(value.length===10?value+'T12:00:00':value);return Number.isNaN(+date)?'Not set':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(date);}
function dateTimeLocal(iso:string|null|undefined){if(!iso)return '';const d=new Date(iso);const p=(n:number)=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());}
function isNetworkFailure(e:unknown){return e instanceof TypeError||(e instanceof Error&&'code' in e&&e.code==='auth/network-request-failed');}
function overlayPending(data:Bootstrap,edits:PendingEdit[]):Bootstrap{return {...data,tasks:data.tasks.map(t=>{const edit=edits.find(e=>e.taskId===t.id);return edit?{...t,...edit.changes} as MarathonTask:t;})};}
async function api<T>(path:string,init:RequestInit={}):Promise<T>{
 const headers=await authHeaders();
 const response=await fetch(path,{...init,cache:'no-store',headers:{...headers,...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}});
 const body=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(body.error||'The request could not be completed.');(error as Error&{status:number}).status=response.status;throw error;}
 return body as T;
}
function errorMessage(e:unknown){return e instanceof Error?e.message:'An unexpected error occurred.';}
function progressClass(status:MarathonStatus){return 'ml-status ml-status-'+status;}
function priorityRank(p:string){return p.startsWith('P1')?0:p.startsWith('P2')?1:2;}
function sortTasks(tasks:MarathonTask[]){return [...tasks].sort((a,b)=>priorityRank(a.priority)-priorityRank(b.priority)||(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||a.id.localeCompare(b.id));}

export function MarathonWorkspace({section='overview'}:{section?:string}){
 const router=useRouter();
 const pathname=usePathname(),searchParams=useSearchParams();
 const view=marathonViewForPath(pathname,section);
 const [state,setState]=useState<Bootstrap>(blank),[loading,setLoading]=useState(true),[offline,setOffline]=useState(false);
 const [authError,setAuthError]=useState(''),[notice,setNotice]=useState(''),[queuedEdits,setQueuedEdits]=useState<PendingEdit[]>([]);
 const [drawer,setDrawer]=useState<MarathonTask|null>(null),[newTask,setNewTask]=useState(false),[mobile,setMobile]=useState(false);
 const [alertsOpen,setAlertsOpen]=useState(false);
 const [saving,setSaving]=useState(false),[query,setQuery]=useState(''),[filterStatus,setFilterStatus]=useState('all');
 const [filterPriority,setFilterPriority]=useState('all'),[filterLead,setFilterLead]=useState('all');
 const [focus,setFocus]=useState<MarathonFocus>('all'),[filtersOpen,setFiltersOpen]=useState(false);
 const categoryParam=searchParams.get('category');
 const filterCategory=isMarathonCategoryId(categoryParam)?categoryParam:'all';
 const [events,setEvents]=useState<EventItem[]>([]);
 const [suggestTask,setSuggestTask]=useState(''),[suggestText,setSuggestText]=useState(''),[suggestStatus,setSuggestStatus]=useState<MarathonStatus>('done');
 const [inviteEmail,setInviteEmail]=useState(''),[inviteRole,setInviteRole]=useState<typeof roles[number]>('kasaClient');
 const authUid=useRef(''),syncingRef=useRef(false),initializedUid=useRef(''),suggestionRequest=useRef(0),reviewRequest=useRef(0),lastHydrateStarted=useRef(0);
 const [syncing,setSyncing]=useState(false),[reviewEdit,setReviewEdit]=useState<PendingEdit|null>(null);
 const [reviewTask,setReviewTask]=useState<MarathonTask|null>(null),[reviewError,setReviewError]=useState('');
 const [suggestionCursor,setSuggestionCursor]=useState<string|null>(null),[suggestionFilter,setSuggestionFilter]=useState('pending');
 const [suggestionLoading,setSuggestionLoading]=useState(false);
 useEffect(()=>{
  if(!mobile)return;
  const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobile(false);};
  document.addEventListener('keydown',closeOnEscape);
  return ()=>document.removeEventListener('keydown',closeOnEscape);
 },[mobile]);
 const pending=queuedEdits.map(x=>x.taskId);
 const uid=state.identity.uid;
 const hydrate=useCallback(async(userUid:string)=>{
  lastHydrateStarted.current=Date.now();
  try{
   const data=await api<Bootstrap>('/api/marathon/bootstrap');
   if(authUid.current!==userUid)return;
   let local:PendingEdit[]=[];
   try{local=await pendingMarathonEdits(userUid);}
   catch{setNotice('Offline storage is unavailable. Changes require a successful online save on this device.');}
   if(authUid.current!==userUid)return;
   const next=overlayPending(data,local);
   const initial=initializedUid.current!==userUid;
   setState(previous=>initial?next:{...next,suggestions:previous.suggestions});
   if(initial){setSuggestionCursor(data.nextSuggestionCursor||null);initializedUid.current=userUid;}
   setQueuedEdits(local);setOffline(false);setAuthError('');
   await saveMarathonCache(userUid,data).catch(()=>{});
  }catch(e){
   if(authUid.current!==userUid)return;
   if(isNetworkFailure(e)){
    const cached=await readMarathonCache(userUid);
    if(cached){
     const local=await pendingMarathonEdits(userUid).catch(()=>[]);
     if(authUid.current!==userUid)return;
     setState(overlayPending(cached.data as Bootstrap,local));setQueuedEdits(local);
     setOffline(true);setAuthError('');return;
    }
   }
   // Never continue displaying a privileged cached workspace after a server denial.
   setState(blank);setQueuedEdits([]);initializedUid.current='';setAuthError(errorMessage(e));
  }finally{if(authUid.current===userUid)setLoading(false);}
 },[]);
 useEffect(()=>{
  let active=true;const a=getClientAuth();
  if(!a){setAuthError('Firebase sign-in is not configured.');setLoading(false);return;}
  const unsub=onAuthStateChanged(a,user=>{
   if(!active)return;
   const nextUid=user?.uid||'';
   if(authUid.current!==nextUid){setState(blank);setQueuedEdits([]);setReviewEdit(null);setLoading(true);initializedUid.current='';}
   authUid.current=nextUid;
   if(!user){router.replace('/marthon/login');return;}
   if(!user.emailVerified){setAuthError('Verify your email address first.');setLoading(false);return;}
   void hydrate(user.uid);
  });
  return ()=>{active=false;authUid.current='';unsub();};
 },[hydrate,router]);
 const refresh=useCallback(async()=>{if(uid)await hydrate(uid);},[hydrate,uid]);
 useEffect(()=>{
  if(!uid)return;
  // Near-live authorized revalidation, without granting raw Firestore access.
  // Skip hidden/offline tabs and leave queued local edits intact.
  const timer=window.setInterval(()=>{
   if(document.visibilityState==='visible'&&navigator.onLine&&!syncingRef.current&&
     Date.now()-lastHydrateStarted.current>=60000)void refresh();
  },15000);
  return ()=>window.clearInterval(timer);
 },[uid,refresh]);
 useEffect(()=>{
  // Keep long-lived workspaces current without blocking each view switch.
  if(uid&&!offline&&Date.now()-lastHydrateStarted.current>=60000)void refresh();
 },[view,uid,offline,refresh]);
 const flush=useCallback(async()=>{
  if(!uid||!navigator.onLine||syncingRef.current)return;
  syncingRef.current=true;setSyncing(true);
  let hadPending=false;
  const run=async()=>{
   const attempted=new Set<string>();
   while(authUid.current===uid){
    const list=await pendingMarathonEdits(uid);
    if(list.length)hadPending=true;
    let sentAny=false;
    for(const entry of list){
     if(authUid.current!==uid)return;
     const id=entry.submitted?.mutationId||entry.mutationId;
     if(entry.conflict||attempted.has(id))continue;
     const edit=await claimMarathonEdit(entry.key);
     if(!edit)continue;
     attempted.add(edit.mutationId);sentAny=true;
     try{
      const result=await api<{task:MarathonTask;appliedRevision:number}>('/api/marathon/tasks/'+encodeURIComponent(edit.taskId),{
       method:'PATCH',body:JSON.stringify({expectedRevision:edit.expectedRevision,mutationId:edit.mutationId,changes:edit.changes})
      });
      await acknowledgeMarathonEdit(edit,result.appliedRevision);
     }catch(e){
      const status=(e as Error&{status?:number}).status;
      if(await handleMarathonSyncFailure(edit,status,errorMessage(e))){
       setNotice('A saved edit needs review. Other actions continue syncing. Open Offline edits to compare and resolve it.');
       continue;
      }
      setNotice('Saved edits remain on this device. '+errorMessage(e));
      return;
     }
    }
    if(!sentAny)break;
   }
  };
  try{
   // Coordinate tabs as well as React callbacks. The persisted submitted request
   // and compare-and-swap acknowledgement also protect browsers without Web Locks.
   if(navigator.locks)await navigator.locks.request('kasa-marathon-sync:'+uid,run);else await run();
  }catch(e){if(authUid.current===uid)setNotice('Unable to sync saved edits. '+errorMessage(e));}
  finally{
   if(authUid.current===uid){if(hadPending)await hydrate(uid);setSyncing(false);}
   syncingRef.current=false;
  }
 },[uid,hydrate]);
 useEffect(()=>{
  if(!uid)return;
  const online=()=>{void refresh().then(()=>flush());};
  const away=()=>setOffline(true);
  const focus=()=>{if(navigator.onLine)void (Date.now()-lastHydrateStarted.current>=60000?refresh().then(()=>flush()):flush());};
  window.addEventListener('online',online);window.addEventListener('offline',away);window.addEventListener('focus',focus);
  const timer=window.setInterval(()=>{if(navigator.onLine)void flush();},30000);
  if(navigator.onLine)void flush();else setOffline(true);
  return ()=>{window.removeEventListener('online',online);window.removeEventListener('offline',away);window.removeEventListener('focus',focus);window.clearInterval(timer);};
 },[uid,flush,refresh]);
 const loadSuggestions=useCallback(async(cursor:string|null=null)=>{
  if(!uid)return;
  const request=++suggestionRequest.current;setSuggestionLoading(true);
  try{
   const page=await api<{suggestions:Suggestion[];nextSuggestionCursor:string|null}>('/api/marathon/suggestions?status='+suggestionFilter+(cursor?'&cursor='+encodeURIComponent(cursor):''));
   if(authUid.current!==uid||request!==suggestionRequest.current)return;
   setState(s=>({...s,suggestions:cursor?[...new Map([...s.suggestions,...page.suggestions].map(x=>[x.id,x])).values()]:page.suggestions}));
   setSuggestionCursor(page.nextSuggestionCursor);
  }catch(e){if(authUid.current===uid)setNotice(errorMessage(e));}
  finally{if(request===suggestionRequest.current)setSuggestionLoading(false);}
 },[uid,suggestionFilter]);
 useEffect(()=>{if(view==='recommendations'&&!offline)void loadSuggestions();},[view,offline,loadSuggestions]);
 async function inspectEdit(edit:PendingEdit){
  const request=++reviewRequest.current;
  setReviewEdit(edit);setReviewTask(null);setReviewError('');
  try{
   const result=await api<{task:MarathonTask}>('/api/marathon/tasks/'+encodeURIComponent(edit.taskId));
   if(authUid.current===uid&&request===reviewRequest.current)setReviewTask(result.task);
  }catch(e){if(authUid.current===uid&&request===reviewRequest.current)setReviewError(errorMessage(e));}
 }
 async function resolveEdit(retry:boolean){
  if(!reviewEdit||(retry&&(!reviewTask||reviewTask.id!==reviewEdit.taskId)))return;
  setSaving(true);
  try{
   const resolved=await resolveMarathonEdit(reviewEdit,retry?reviewTask!.revision:undefined);
   if(!resolved)throw Error('This saved edit changed or is syncing. Close this comparison and review it again.');
   setReviewEdit(null);await hydrate(uid);
   setNotice(retry?'Your changes will be checked against the reviewed version before saving.':'Device edit discarded. The saved online record is retained.');
   if(retry)void flush();
  }catch(e){setReviewError(errorMessage(e));}finally{setSaving(false);}
 }
 useEffect(()=>{if(view==='activity'&&uid&&!offline)void api<{events:EventItem[]}>('/api/marathon/activity').then(x=>setEvents(x.events)).catch(e=>setNotice(errorMessage(e)));},[view,uid,offline]);
 const tasks=state.tasks;
 const today=marathonToday();
 const complete=tasks.filter(t=>t.status==='done'&&!t.archived).length;
 const active=tasks.filter(t=>!t.archived);
 const fiveDayDeadline=new Date(Date.parse(today+'T12:00:00Z')+5*86400000).toISOString().slice(0,10);
 const attentionTasks=active.filter(t=>t.status!=='done'&&
   (t.status==='blocked'||t.priority.startsWith('P1')||
    Boolean(t.dueDate&&t.dueDate<=fiveDayDeadline)));
 const overdue=active.filter(t=>t.status!=='done'&&t.dueDate&&t.dueDate<today).length;
 const inProgress=active.filter(t=>t.status==='doing').length;
 const critical=active.filter(t=>t.status!=='done'&&t.importance==='Critical').length;
 const pct=active.length?Math.round(complete/active.length*100):0;
 const daysLeft=Math.max(0,Math.ceil((new Date('2027-03-21T06:00:00+02:00').getTime()-Date.now())/86400000));
 const leads=useMemo(()=>[...new Set(tasks.map(t=>t.lead).filter(Boolean))].sort(),[tasks]);
 function selectCategory(value:string){
  const url=new URL(window.location.href);
  if(value==='all')url.searchParams.delete('category');else url.searchParams.set('category',value);
  window.history.replaceState(null,'',url.pathname+url.search+url.hash);
 }
 const uncategorizedCount=active.filter(t=>categoryForSection(t.section).id==='uncategorized').length;
 const filtered=useMemo(()=>sortTasks(tasks.filter(t=>matchesMarathonFilters(t,{
  category:filterCategory,status:filterStatus,priority:filterPriority,lead:filterLead,query,focus,today
 }))),[tasks,filterCategory,filterStatus,filterPriority,filterLead,query,focus,today]);
 const focusBase=useMemo(()=>tasks.filter(t=>matchesMarathonFilters(t,{category:filterCategory,priority:filterPriority,lead:filterLead,query})),[tasks,filterCategory,filterPriority,filterLead,query]);
 const focusCounts=useMemo(()=>marathonFocusCounts(focusBase,today),[focusBase,today]);
 const allFocusCounts=useMemo(()=>marathonFocusCounts(tasks,today),[tasks,today]);
 const extraFilterCount=Number(filterStatus!=='all')+Number(filterPriority!=='all')+Number(filterLead!=='all');
 const hasFilters=filterCategory!=='all'||focus!=='all'||!!query||extraFilterCount>0;
 function clearTaskFilters(nextFocus:MarathonFocus='all'){
  setFocus(nextFocus);setFilterStatus('all');setFilterPriority('all');setFilterLead('all');setQuery('');
 }
 function resetTaskView(){clearTaskFilters();selectCategory('all');}
 function showActions(nextFocus:MarathonFocus){
  clearTaskFilters(nextFocus);setMobile(false);window.history.pushState(null,'','/marthon/operations');
 }
 const categoryGroups=useMemo(()=>groupMarathonCategories(filtered),[filtered]);
 async function changeTask(task:MarathonTask,changes:EditChanges){
  if(!state.permissions.edit)return;
  setSaving(true);setNotice('');
  try{
   // Persist before any request, including online edits. A lost response can then
   // be retried with the exact submitted ID and payload after a reload.
   try{await queueMarathonEdit(uid,task.id,task.revision,changes);}
   catch(storageError){
    if(!navigator.onLine||offline)throw storageError;
    // Browsers that disable device storage can still confirm an online save.
    // Keep the form if the server cannot confirm it; never claim it was queued.
    const result=await api<{task:MarathonTask}>('/api/marathon/tasks/'+encodeURIComponent(task.id),{
     method:'PATCH',body:JSON.stringify({expectedRevision:task.revision,mutationId:crypto.randomUUID(),changes})
    });
    if(authUid.current!==uid)return;
    setState(s=>({...s,tasks:s.tasks.map(t=>t.id===task.id?result.task:t)}));
    setDrawer(null);await hydrate(uid);setNotice('Action saved online. Offline storage is unavailable on this device.');return;
   }
   const local=await pendingMarathonEdits(uid);
   if(authUid.current!==uid)return;
   setQueuedEdits(local);setState(previous=>overlayPending(previous,local));setDrawer(null);
   if(navigator.onLine&&!offline){
    await flush();
    const remaining=await pendingMarathonEdits(uid);
    if(!remaining.some(x=>x.taskId===task.id))setNotice('Action updated successfully.');
    else setNotice('Your edit is saved on this device. Open Offline edits to check its sync status.');
   }else setNotice('Saved on this device. Will sync when the connection returns.');
  }catch(e){setNotice('This edit could not be saved. Keep the form open and retry. '+errorMessage(e));}
  finally{setSaving(false);}
 }
 async function createTask(values:{title:string;lead:string;section:string;dueDate:string|null;priority:string;importance:string;nextStep:string;notes:string}){
  setSaving(true);
  try{
   if(!navigator.onLine)throw Error('Creating new actions requires an internet connection.');
   const result=await api<{task:MarathonTask}>('/api/marathon/tasks',{method:'POST',body:JSON.stringify(values)});
   setState(s=>({...s,tasks:[result.task,...s.tasks]}));setNewTask(false);setNotice('New operation created.');
  }catch(e){setNotice(errorMessage(e));}finally{setSaving(false);}
 }
 async function sendSuggestion(e:React.FormEvent){
  e.preventDefault();setSaving(true);
  try{
   if(!navigator.onLine)throw Error('Recommendations can be submitted after reconnecting.');
   await api<{suggestion:Suggestion}>('/api/marathon/suggestions',{method:'POST',body:JSON.stringify({taskId:suggestTask,recommendation:suggestText,proposedStatus:suggestStatus})});
   await loadSuggestions();
   setSuggestText('');setSuggestTask('');setNotice('Recommendation submitted to the review queue.');
  }catch(e){setNotice(errorMessage(e));}finally{setSaving(false);}
 }
 async function reviewSuggestion(s:Suggestion,decision:'accepted'|'rejected'){
  try{
   await api('/api/marathon/suggestions/'+encodeURIComponent(s.id),{method:'PATCH',body:JSON.stringify({decision})});
   await loadSuggestions();
   setNotice('Recommendation '+decision+'. The actual checklist requires a separate approval and update.');
  }catch(e){setNotice(errorMessage(e));}
 }
 async function updateMember(member:Member,changes:{active?:boolean;role?:MarathonRole}){
  if(!state.permissions.super)return;
  try{
   const result=await api<{member:Member}>('/api/marathon/members/'+encodeURIComponent(member.uid),{method:'PATCH',body:JSON.stringify(changes)});
   setState(x=>({...x,members:x.members.map(m=>m.uid===member.uid?result.member:m)}));
   setNotice('Member access updated.');
  }catch(e){setNotice(errorMessage(e));}
 }
 async function invite(e:React.FormEvent){
  e.preventDefault();setSaving(true);
  try{
   const result=await api<{member:Member}>('/api/marathon/members',{method:'POST',body:JSON.stringify({email:inviteEmail,role:inviteRole})});
   setState(x=>({...x,members:[...x.members.filter(y=>y.uid!==result.member.uid),result.member]}));
   setInviteEmail('');setNotice('Marathon membership updated.');
  }catch(e){setNotice(errorMessage(e));}finally{setSaving(false);}
 }
 function exportCSV(){
  const cols=['id','section','title','lead','dueDate','priority','importance','status','completedAt','evidence','notes'];
  const content=[cols.join(','),...sortTasks(tasks).map(t=>cols.map(key=>csvEscape(t[key as keyof MarathonTask])).join(','))].join('\r\n');
  const blob=new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='KASA-Life-Marathon-Operations.csv';a.click();URL.revokeObjectURL(url);
 }
 const displayName=state.identity.displayName||state.identity.email.split('@')[0]||'Team member';
 const schoolDestination=schoolWorkspace(state.identity.schoolRole);
 const menu=nav.filter(x=>x.view!=='super'||state.permissions.super).filter(x=>x.view!=='settings'||state.permissions.super).filter(x=>x.view!=='archive'||state.permissions.edit);
 const dailyMenu=menu.filter(item=>['overview','operations','categories','timeline','recommendations'].includes(item.view));
 const toolMenu=menu.filter(item=>!dailyMenu.includes(item));
 function navigationItem(item:typeof nav[number]){
  const Icon=item.icon;
  return <Link key={item.view} href={item.view==='overview'?'/marthon':'/marthon/'+item.view} className={'ml-nav-item '+(view===item.view?'selected':'')} aria-current={view===item.view?'page':undefined} onClick={()=>setMobile(false)}><Icon size={19}/><span>{item.label}</span>{item.view==='recommendations'&&state.suggestions.some(s=>s.status==='pending')&&<i/>}</Link>;
 }
 async function logout(){if(pending.length&&!window.confirm('You have '+pending.length+' unsynced edits stored on this device. Sign out anyway?'))return;await signOutClient();router.replace('/marthon/login');}

 if(loading)return <div className="ml-init" role="status"><span className="ml-spinner"/><h2>Opening Marathon Command Centre</h2><p>Verifying your account and loading event operations…</p></div>;
 if(authError&&!uid)return <main className="ml-init"><Shield size={32}/><h2>Marathon workspace unavailable</h2><p>{authError}</p><Link className="ml-primary" href="/marthon/login">Return to secure sign in</Link></main>;
 return <div className="ml-app">
  <aside id="ml-workspace-menu" className={'ml-sidebar '+(mobile?'ml-sidebar-open':'')}>
   <Link href="/marthon" className="ml-sidebar-brand" onClick={()=>setMobile(false)}><span className="ml-mark">K</span><span><b>KASA <em>LIFE</em></b><small>MARATHON OPERATIONS</small></span></Link>
   <div className="ml-sidebar-scroll" tabIndex={0} aria-label="Scrollable Marathon navigation">
   <div className="ml-nav-section">WORKSPACE</div>
   <nav aria-label="Marathon workspace navigation">{dailyMenu.map(navigationItem)}</nav>
   <details className="ml-nav-tools" open={toolMenu.some(item=>item.view===view)||undefined}><summary>More tools <ChevronDown size={15}/></summary><nav aria-label="Other Marathon tools">{toolMenu.map(navigationItem)}</nav></details>
   <div className="ml-school-switch"><span className="ml-nav-section">YOUR WORKSPACES</span>
    <Link href={schoolDestination} className="ml-nav-item ml-school-link"><ArrowDownRight size={19}/><span>Return to KASA School</span></Link>
   </div>
   </div><SidebarScrollControls targetSelector=".ml-sidebar-scroll"/>
   <div className="ml-sidebar-event"><div className="ml-sidebar-event-top"><span className="ml-event-kicker"><span className="ml-pulse"/> EVENT COUNTDOWN</span><CalendarDays size={18}/></div><strong>{daysLeft}<small> days</small></strong><span>Sunday, 21 March 2027</span><div className="ml-event-line"><span style={{width:Math.max(5,100-daysLeft/150*100)+'%'}}/></div></div>
   <div className="ml-sidebar-bottom"><div className="ml-sidebar-person"><span className="ml-avatar">{displayName.slice(0,2).toUpperCase()}</span><div><b>{displayName}</b><small>School: {state.identity.schoolRole} · Marathon: {state.identity.role}</small></div><button title="Sign out" aria-label="Sign out" onClick={()=>void logout()}><LogOut size={18}/></button></div></div>
  </aside>
  {mobile&&<button className="ml-mobile-overlay" aria-label="Close menu" onClick={()=>setMobile(false)}/>}
  <main className="ml-main">
   <header className="ml-topbar"><div className="ml-top-left"><button className="ml-mobile-menu" aria-label="Open navigation" aria-controls="ml-workspace-menu" aria-expanded={mobile} onClick={()=>setMobile(true)}><Menu size={22}/></button><span className="ml-breadcrumb">KASA Life Marathon</span><ChevronRight size={15}/><strong>{menu.find(x=>x.view===view)?.label||'Home'}</strong></div><div className="ml-top-actions"><Link href="/marthon/sync" className={'ml-sync-status '+(offline?'off':'')} aria-label={pending.length?pending.length+' saved edits. Open offline edits.':'View offline edits'}>{offline?<WifiOff size={15}/>:pending.length?<CloudOff size={15}/>:<Cloud size={15}/>} {syncing?'Syncing…':offline?'Offline':pending.length?pending.length+' pending':'Synced'}</Link><button className="ml-alert-toggle" type="button" aria-label={'Reminders: '+attentionTasks.length+' actions need attention'} title="Action reminders" aria-expanded={alertsOpen} onClick={()=>setAlertsOpen(v=>!v)}><Bell size={18}/>{attentionTasks.length>0&&<span className="ml-alert-count">{attentionTasks.length>99?'99+':attentionTasks.length}</span>}</button><button aria-label="Refresh" title="Refresh data" onClick={()=>void refresh().then(()=>flush())}><RefreshCcw size={18}/></button><span className="ml-top-divider"/><span className="ml-avatar ml-avatar-small">{displayName.slice(0,2).toUpperCase()}</span></div>{alertsOpen&&<MarathonAlertCenter tasks={tasks} today={today} onOpen={setDrawer} onClose={()=>setAlertsOpen(false)}/>}</header>
   <div className="ml-content">
    {!!notice&&<div className="ml-notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss notification"><X size={17}/></button></div>}
    {!!authError&&uid&&<div className="ml-notice ml-warning"><AlertTriangle size={17}/>{authError}</div>}
    {offline&&<div className="ml-offline-notice"><CloudOff size={17}/> You are viewing cached operations. Changes to existing tasks are stored on this device until connectivity returns.</div>}
    {view==='overview'&&<>
     <div className="ml-heading-row"><div><span className="ml-eyebrow">EVENT CONTROL CENTRE · 2027</span><h1>Good day, {displayName.split(' ')[0]} <Flag className="ml-greeting" size={24}/></h1><p>Here is where your event preparations stand today.</p></div><div className="ml-heading-actions"><button className="ml-secondary" onClick={exportCSV}><Download size={17}/> Export</button>{state.permissions.edit&&<button className="ml-primary" onClick={()=>setNewTask(true)}><Plus size={17}/> New action</button>}</div></div>
     <div className="ml-start-actions" aria-label="Start working"><button onClick={()=>showActions('open')}><ClipboardCheck size={22}/><span><b>Open checklist</b><small>{allFocusCounts.open} actions to finish</small></span><ArrowRight size={17}/></button><button onClick={()=>showActions('attention')}><Flag size={22}/><span><b>Needs attention</b><small>{allFocusCounts.attention} urgent, blocked or overdue</small></span><ArrowRight size={17}/></button><Link href="/marthon/categories"><Layers3 size={22}/><span><b>Browse categories</b><small>{marathonCategories.length} workstreams</small></span><ArrowRight size={17}/></Link></div>
     <div className="ml-hero"><div className="ml-hero-copy"><span className="ml-hero-tag"><span className="ml-pulse"/> KASA LIFE MARATHON 2027</span><h2>Making every mile<br/><i>count.</i></h2><p>One shared workspace for planning, approvals, preparations and the event-day experience.</p><Link href="/marthon/operations" className="ml-hero-button">Explore operations <ArrowRight size={17}/></Link></div><div className="ml-hero-art"><div className="ml-orbit big"/><div className="ml-orbit small"/><span>21<span className="ml-runner-dot">•</span></span><b>MAR<br/>2027</b></div><div className="ml-hero-foot"><span>21.1 KM HALF MARATHON</span><span>10 KM RUN</span><span>5 KM FAMILY RUN</span></div></div>
     <div className="ml-kpis"><Metric label="Total actions" value={active.length} icon={Layers3} note="Across all workstreams"/><Metric label="Completed" value={complete} icon={CheckCircle2} note={pct+'% of all actions'} accent="green"/><Metric label="In progress" value={inProgress} icon={Clock3} note="Active assignments" accent="blue"/><Metric label="Overdue" value={overdue} icon={AlertTriangle} note="Require immediate attention" accent="amber"/></div>
     <div className="ml-grid-two"><section className="ml-panel"><div className="ml-panel-head"><div><span className="ml-eyebrow">PROGRESS OVERVIEW</span><h3>Event readiness</h3></div><span className="ml-panel-icon"><TrendingUp size={19}/></span></div><div className="ml-progress-content"><div className="ml-donut" style={{background:'conic-gradient(#258660 '+pct+'%,#e9f0ed 0)'}}><div><strong>{pct}%</strong><small>complete</small></div></div><div className="ml-progress-legend"><div><span className="ml-legend-dot green"/>Completed<b>{complete}</b></div><div><span className="ml-legend-dot blue"/>In progress<b>{inProgress}</b></div><div><span className="ml-legend-dot amber"/>Not started / blocked<b>{active.length-complete-inProgress}</b></div><div className="ml-progress-tip"><Target size={18}/> {critical} critical tasks remain open</div></div></div></section>
      <section className="ml-panel"><div className="ml-panel-head"><div><span className="ml-eyebrow">IMMEDIATE ATTENTION</span><h3>Priority decisions</h3></div><Link href="/marthon/operations" className="ml-link">View all <ArrowUpRight size={16}/></Link></div><div className="ml-decision-list">{sortTasks(active.filter(t=>t.priority.startsWith('P1')&&t.status!=='done')).slice(0,5).map(t=><button className="ml-decision" key={t.id} onClick={()=>setDrawer(t)}><span className="ml-decision-ic"><Flag size={17}/></span><span><b>{t.title}</b><small>{t.lead} · {formatDate(t.dueDate)}</small></span><ChevronRight size={17}/></button>)}{!active.some(t=>t.priority.startsWith('P1')&&t.status!=='done')&&<p>All immediate decisions have been addressed.</p>}</div></section></div>
     <div className="ml-section-row"><div><span className="ml-eyebrow">WHAT IS NEXT</span><h3>Upcoming operations</h3></div><Link className="ml-link" href="/marthon/operations">Open operations <ArrowRight size={17}/></Link></div>
     <div className="ml-task-list">{sortTasks(active.filter(t=>t.status!=='done')).slice(0,6).map(t=><TaskRow key={t.id} task={t} queued={pending.includes(t.id)} onOpen={()=>setDrawer(t)} onQuickDone={state.permissions.edit?()=>void changeTask(t,{status:t.status==='done'?'todo':'done'}):undefined}/>)}</div>
    </>}
    {view==='categories'&&<>
     <div className="ml-heading-row"><div><span className="ml-eyebrow">CHECKLIST WORKSTREAMS</span><h1>Categories</h1><p>Every action belongs to a workstream from the event checklist. Open a category to review its actions and progress.</p></div><Link className="ml-secondary" href="/marthon/operations">All operations <ArrowRight size={17}/></Link></div>
     <div className="ml-mini-stats"><span>{marathonCategories.length} checklist categories</span><span>{active.length} active actions</span><span>{complete} completed</span>{uncategorizedCount>0&&<span>{uncategorizedCount} need a category</span>}</div>
     <MarathonCategoryBoard tasks={active}/>
    </>}
    {view==='operations'&&<>
     <div className="ml-heading-row"><div><span className="ml-eyebrow">WORKSTREAM MANAGEMENT</span><h1>Checklist</h1><p>Choose a quick view, find an action and record your progress.</p></div><div className="ml-heading-actions"><button className="ml-secondary" onClick={exportCSV}><Download size={17}/> Export</button>{state.permissions.edit&&<button className="ml-primary" onClick={()=>setNewTask(true)}><Plus size={17}/> New action</button>}</div></div>
     <div className="ml-mini-stats"><span><i className="ml-legend-dot green"/>{complete} completed</span><span><i className="ml-legend-dot blue"/>{inProgress} in progress</span><span><i className="ml-legend-dot amber"/>{overdue} overdue</span><span>{active.length} total</span></div>
     <MarathonQuickViews focus={focus} counts={focusCounts} onChange={next=>{setFocus(next);setFilterStatus('all');}}/>
     {focus==='attention'&&<p className="ml-view-help">Open actions marked P1, blocked actions, and actions past their due date.</p>}
     {focus==='week'&&<p className="ml-view-help">Open actions due today or in the following six days, using Lusaka time.</p>}
     <div className="ml-filterbar"><div className="ml-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search actions, IDs, owners…" aria-label="Search actions"/></div><select className="ml-category-select" value={filterCategory} onChange={e=>selectCategory(e.target.value)} aria-label="Filter by category"><option value="all">All categories</option>{marathonCategories.map(c=><option key={c.id} value={c.id}>{String(c.order).padStart(2,'0')} · {c.label}</option>)}{uncategorizedCount>0&&<option value="uncategorized">Needs a category</option>}</select><button className="ml-secondary ml-filter-toggle" aria-expanded={filtersOpen} aria-controls="ml-extra-filters" onClick={()=>setFiltersOpen(open=>!open)}><SlidersHorizontal size={16}/> More filters {extraFilterCount>0&&<b>{extraFilterCount}</b>}</button>{hasFilters&&<button className="ml-clear-filters" onClick={resetTaskView}>Reset filters</button>}</div>
     <div className="ml-extra-filters" id="ml-extra-filters" hidden={!filtersOpen}><label>Status<select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);setFocus('all');}} aria-label="Filter by status"><option value="all">All statuses</option>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Priority<select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} aria-label="Filter by priority"><option value="all">All priorities</option><option value="P1">P1 · Act now</option><option value="P2">P2 · Next 30 days</option><option value="P3">P3 · Scheduled</option></select></label><label>Responsible team<select value={filterLead} onChange={e=>setFilterLead(e.target.value)} aria-label="Filter by team"><option value="all">All teams</option>{leads.map(l=><option key={l}>{l}</option>)}</select></label></div>
     <div className="ml-task-results"><b aria-live="polite">{filtered.length} actions in {categoryGroups.length} {categoryGroups.length===1?'category':'categories'}</b><span>Urgency and due date within each category</span></div>
     <div className="ml-category-groups">{categoryGroups.map(group=><section className="ml-category-group" key={group.category.id} aria-labelledby={'ml-category-'+group.category.id}><header className="ml-category-group-header"><span className="ml-category-number">{group.category.id==='uncategorized'?<Layers3 size={17}/>:String(group.category.order).padStart(2,'0')}</span><h2 id={'ml-category-'+group.category.id}>{group.category.label}</h2><span>{group.tasks.length} {group.tasks.length===1?'action':'actions'}</span></header><div className="ml-task-list">{group.tasks.map(t=><TaskRow key={t.id} task={t} queued={pending.includes(t.id)} onOpen={()=>setDrawer(t)} onQuickDone={state.permissions.edit?()=>void changeTask(t,{status:t.status==='done'?'todo':'done'}):undefined}/>)}</div></section>)}{!filtered.length&&<div className="ml-panel"><EmptyState text="No actions match your filters."/><button className="ml-secondary" onClick={resetTaskView}>Reset filters</button></div>}</div>
    </>}
    {view==='timeline'&&<>
     <div className="ml-heading-row"><div><span className="ml-eyebrow">DATES & DEPENDENCIES</span><h1>Event timeline</h1><p>Track the major stages from decision-making to race day and close-out.</p></div><span className="ml-countdown-pill"><CalendarDays size={18}/>{daysLeft} days to race day</span></div>
     <div className="ml-timeline">{[
       {name:'Immediate decisions',when:'October 2026',filter:(t:MarathonTask)=>t.priority.startsWith('P1')},
       {name:'Approvals and launch preparation',when:'November – December 2026',filter:(t:MarathonTask)=>t.dueDate!==null&&t.dueDate>='2026-11-01'&&t.dueDate<'2027-01-01'},
       {name:'Race kit and suppliers',when:'January – February 2027',filter:(t:MarathonTask)=>t.dueDate!==null&&t.dueDate>='2027-01-01'&&t.dueDate<'2027-03-01'},
       {name:'Final readiness and race week',when:'March 2027',filter:(t:MarathonTask)=>t.dueDate!==null&&t.dueDate>='2027-03-01'&&t.dueDate<'2027-03-22'},
       {name:'Close-out and final reporting',when:'After race day',filter:(t:MarathonTask)=>t.dueDate!==null&&t.dueDate>'2027-03-21'}
      ].map((phase,i)=>{const list=active.filter(phase.filter);const n=list.filter(x=>x.status==='done').length;return <section className="ml-timeline-phase" key={phase.name}><span className="ml-timeline-node">{i+1}</span><div className="ml-panel"><span className="ml-eyebrow">{phase.when}</span><h3>{phase.name}</h3><p>{n} of {list.length} actions completed</p><div className="ml-phase-line"><span style={{width:(list.length?n/list.length*100:0)+'%'}}/></div><div className="ml-phase-items">{sortTasks(list).slice(0,5).map(t=><button key={t.id} onClick={()=>setDrawer(t)}><span className={progressClass(t.status)}>{statusLabels[t.status]}</span><span className="ml-phase-task"><b>{t.title}</b><small>{categoryForSection(t.section).label}</small></span><ChevronRight size={15}/></button>)}</div></div></section>;})}</div>
    </>}
    {view==='archive'&&state.permissions.edit&&<>
     <div className="ml-heading-row"><div><span className="ml-eyebrow">RECORD RETENTION</span><h1>Archive & recovery</h1><p>Archived activities remain in Firestore with a full change history. Select a record and untick Archive to restore it.</p></div></div>
     <div className="ml-task-results"><b>{tasks.filter(t=>t.archived).length} archived actions</b><span>Not included in active completion figures</span></div>
     <div className="ml-task-list">{sortTasks(tasks.filter(t=>t.archived)).map(t=><TaskRow key={t.id} task={t} queued={pending.includes(t.id)} onOpen={()=>setDrawer(t)}/>)}{!tasks.some(t=>t.archived)&&<EmptyState text="The archive is empty. Your active checklist is intact."/>}</div>
    </>}
    {view==='recommendations'&&<>
     <div className="ml-heading-row"><div><span className="ml-eyebrow">COLLABORATION</span><h1>Recommendations</h1><p>Suggest corrections, report progress and route proposals for review.</p></div></div>
     <div className="ml-grid-two ml-recommend-layout"><div className="ml-panel"><div className="ml-panel-head"><div><span className="ml-eyebrow">SEND A SUGGESTION</span><h3>Propose an update</h3></div><MessageSquarePlus size={22}/></div><form className="ml-form" onSubmit={sendSuggestion}><label>Checklist action<select required value={suggestTask} onChange={e=>setSuggestTask(e.target.value)}><option value="">Select action</option>{groupMarathonCategories(sortTasks(active)).map(g=><optgroup key={g.category.id} label={g.category.label}>{g.tasks.map(t=><option key={t.id} value={t.id}>{t.id} · {t.title.slice(0,70)}</option>)}</optgroup>)}</select></label><label>Suggested progress<select value={suggestStatus} onChange={e=>setSuggestStatus(e.target.value as MarathonStatus)}>{Object.entries(statusLabels).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label><label>Your recommendation<textarea required minLength={10} rows={5} placeholder="Describe the progress made, evidence available, or change that should be recorded." value={suggestText} onChange={e=>setSuggestText(e.target.value)}/></label><button disabled={saving} className="ml-primary" type="submit"><ArrowRight size={17}/> Submit recommendation</button></form></div>
      <div className="ml-panel"><div className="ml-panel-head"><div><span className="ml-eyebrow">REVIEW DESK</span><h3>Submitted proposals</h3></div><span className="ml-count-badge">{state.suggestions.length}</span></div><div className="ml-suggestion-filters">{state.permissions.review&&<label>Status <select aria-label="Recommendation status" value={suggestionFilter} onChange={e=>setSuggestionFilter(e.target.value)}><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Declined</option><option value="all">All statuses</option></select></label>}<button className="ml-secondary" disabled={suggestionLoading||offline} onClick={()=>void loadSuggestions()}><RefreshCcw size={15}/> Refresh</button></div><div className="ml-suggestions" aria-busy={suggestionLoading}>{state.suggestions.length?state.suggestions.map(s=><article className="ml-suggestion" key={s.id}><div><b>{s.taskId}</b><span className="ml-status ml-status-doing">{s.status}</span></div><p>{s.recommendation}</p><small>From {s.createdName} · {formatDate(s.createdAt)}</small>{state.permissions.review&&s.status==='pending'&&<div className="ml-suggestion-actions"><button onClick={()=>void reviewSuggestion(s,'accepted')}><Check size={16}/> Accept</button><button onClick={()=>void reviewSuggestion(s,'rejected')}><X size={16}/> Decline</button></div>}</article>):<EmptyState text={suggestionLoading?"Loading recommendations…":"No recommendations in this view."}/>}</div>{suggestionCursor&&<button className="ml-secondary ml-load-more" disabled={suggestionLoading||offline} onClick={()=>void loadSuggestions(suggestionCursor)}>{suggestionLoading?'Loading…':'Load more recommendations'}</button>}</div></div>
    </>}
    {view==='sync'&&<>
     <div className="ml-heading-row"><div><span className="ml-eyebrow">DEVICE & ONLINE CHANGES</span><h1>Offline edits</h1><p>Review changes saved on this device. Resolve conflicts without blocking other actions.</p></div><button className="ml-primary" disabled={syncing||offline} onClick={()=>void flush()}><RefreshCcw size={17}/>{syncing?'Syncing…':'Sync now'}</button></div>
     <div className="ml-sync-list">{queuedEdits.map(edit=><article className="ml-panel" key={edit.key}><div className="ml-panel-head"><div><span className="ml-eyebrow">{edit.taskId}</span><h3>{tasks.find(t=>t.id===edit.taskId)?.title||'Saved action'}</h3></div><span className={edit.conflict?'ml-status ml-status-blocked':'ml-status ml-status-doing'}>{edit.conflict?'Needs review':edit.submitted?'Awaiting confirmation':'Waiting to sync'}</span></div><p className="ml-panel-description">{edit.conflict||'Your change is saved here until the server confirms it.'}</p><button className="ml-secondary" onClick={()=>void inspectEdit(edit)}><Eye size={17}/> Review saved changes</button></article>)}{!queuedEdits.length&&<EmptyState text="No offline edits are waiting on this device."/>}</div>
    </>}
    {view==='activity'&&<>
     <div className="ml-heading-row"><div><span className="ml-eyebrow">ACCOUNTABILITY</span><h1>Activity & audit log</h1><p>Every recorded update includes who submitted it and when it was recorded.</p></div><button className="ml-secondary" onClick={()=>void api<{events:EventItem[]}>('/api/marathon/activity').then(x=>setEvents(x.events)).catch(e=>setNotice(errorMessage(e)))}><RefreshCcw size={16}/> Refresh</button></div>
     <div className="ml-panel ml-activity-panel">{events.length?events.map(e=><div className="ml-activity-item" key={e.id}><span className="ml-activity-icon"><Activity size={17}/></span><div><b>{e.action==='updated'?'Action updated':e.action==='created'?'Action created':e.action==='member.assigned'?'Member assigned':e.action.replaceAll('.',' ')}</b><p>{e.taskId||e.targetUid||'Team access'} · {e.actor||'System'}</p></div><time>{formatDate(e.at)}</time></div>):<EmptyState text="No activity has been recorded yet, or the audit log is offline."/>}</div>
    </>}
    {(view==='settings'||view==='team')&&state.permissions.super&&<>
     <div className="ml-heading-row"><div><span className="ml-eyebrow">ACCESS & RESPONSIBILITY</span><h1>Marathon settings & roles</h1><p>Assign a second workspace role to an existing KASA School profile. The original school role is never changed.</p></div></div>
     {state.permissions.super&&<div className="ml-panel ml-team-invite"><div className="ml-panel-head"><div><span className="ml-eyebrow">SUPER ADMIN CONTROL</span><h3>Grant a second role on a KASA School profile</h3></div><UserPlus size={22}/></div><form onSubmit={invite} className="ml-invite-form"><label>Email address<input type="email" required placeholder="Verified KASA account email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/></label><label>Marathon role<select value={inviteRole} onChange={e=>setInviteRole(e.target.value as typeof inviteRole)}>{roles.map(r=><option key={r} value={r}>{r}</option>)}</select></label><button className="ml-primary" disabled={saving}>Assign role <ArrowRight size={17}/></button></form><p className="ml-form-help">Use the existing verified KASA School email for this person. Only the school super administrator may assign Marathon access here; no separate account is created.</p></div>}
     <div className="ml-panel"><div className="ml-panel-head"><h3>Team directory</h3><span className="ml-count-badge">{state.members.length}</span></div><div className="ml-members">{state.members.map(m=><div className="ml-member" key={m.uid}><span className="ml-avatar">{m.displayName.slice(0,2).toUpperCase()}</span><div><b>{m.displayName}</b><small>{m.email}</small><small>School: {m.schoolRole} · Marathon: {m.role}</small></div>{state.permissions.super?<select className="ml-member-role-select" value={m.role} aria-label={'Role for '+m.email} onChange={e=>void updateMember(m,{role:e.target.value as MarathonRole})}>{roles.map(role=><option key={role}>{role}</option>)}</select>:<span className="ml-role-tag">{m.role}</span>}{state.permissions.super?<button className={m.active?'ml-member-active':'ml-member-inactive'} onClick={()=>void updateMember(m,{active:!m.marathonActive})}>{m.marathonActive?'Disable Marathon':'Enable Marathon'}</button>:<span className={m.active?'ml-member-active':'ml-member-inactive'}>{m.active?'Active':m.schoolActive?'Marathon disabled':'School account disabled'}</span>}</div>)}{!state.members.length&&<EmptyState text={state.permissions.super?'No Marathon team members have been added yet.':'Team membership can be managed by the super administrator.'}/>}</div></div>
    </>}
    {view==='super'&&state.permissions.super&&<>
     <div className="ml-heading-row"><div><span className="ml-eyebrow">INSTITUTIONAL OVERSIGHT</span><h1>Super administrator</h1><p>Control initial data migration, access and the event governance overview.</p></div><span className="ml-role-tag"><ShieldCheck size={16}/> Super admin</span></div>
     <div className="ml-kpis"><Metric label="Total actions" value={active.length} icon={ClipboardCheck} note="In Firestore"/><Metric label="Completion" value={pct+'%'} icon={CheckCheck} note="Verified checklist status" accent="green"/><Metric label="Team accounts" value={state.members.length} icon={Users} note="Secondary roles on school profiles" accent="blue"/><Metric label="Critical open" value={critical} icon={AlertTriangle} note="High impact decisions" accent="amber"/></div>
     <div className="ml-grid-two"><MarathonSeedImport source={state.source??null} meta={state.meta} taskCount={tasks.length} offline={offline} request={api} onApplied={refresh}/>
     <section className="ml-panel"><div className="ml-panel-head"><div><span className="ml-eyebrow">SECURITY MODEL</span><h3>Role separation</h3></div><Shield size={22}/></div><div className="ml-role-list"><div><b>School super administrator</b><span>Inherits full Marathon access and can set secondary roles here</span></div><div><b>kasaAdmin</b><span>Marathon planning and editing; cannot grant roles</span></div><div><b>kasaOperations / kasaEditor</b><span>Manage assigned operations</span></div><div><b>kasaReviewer</b><span>Review recommendations</span></div><div><b>kasaClient</b><span>View and recommend only</span></div></div></section></div>
    </>}
   </div>
  </main>
  {reviewEdit&&<MarathonSyncReview edit={reviewEdit} current={reviewTask} error={reviewError} busy={saving||syncing} onClose={()=>{reviewRequest.current++;setReviewEdit(null);}} onResolve={retry=>void resolveEdit(retry)}/>}
  {drawer&&<TaskDrawer task={drawer} editable={state.permissions.edit} saving={saving} queued={pending.includes(drawer.id)} onClose={()=>setDrawer(null)} onSave={changes=>void changeTask(drawer,changes)} onRecommend={()=>{setSuggestTask(drawer.id);setDrawer(null);window.history.pushState(null,'','/marthon/recommendations');}}/>}
  {newTask&&<NewTaskModal initialSection={filterCategory==='all'?'':categoryForId(filterCategory).section} saving={saving} onClose={()=>setNewTask(false)} onSave={x=>void createTask(x)}/>}
 </div>;
}
function Metric({label,value,icon:Icon,note,accent=''}:{label:string;value:number|string;icon:typeof Layers3;note:string;accent?:string}){return <div className={'ml-metric '+accent}><span className="ml-metric-label">{label}<span className="ml-metric-icon"><Icon size={19}/></span></span><strong>{value}</strong><small>{note}</small></div>;}
function EmptyState({text}:{text:string}){return <div className="ml-empty"><ClipboardCheck size={28}/><p>{text}</p></div>;}
function TaskRow({task,queued,onOpen,onQuickDone}:{task:MarathonTask;queued:boolean;onOpen:()=>void;onQuickDone?:()=>void}){return <article className="ml-task-row"><button className={'ml-task-check '+(task.status==='done'?'checked':'')} aria-label={onQuickDone?(task.status==='done'?'Mark '+task.title+' as not done':'Mark '+task.title+' as done'):'View '+task.title} aria-pressed={task.status==='done'} title={onQuickDone?(task.status==='done'?'Mark as not done':'Mark as done'):'View action'} onClick={onQuickDone||onOpen}>{task.status==='done'?<Check size={15}/>:<Circle size={20}/>}</button><button className="ml-task-title" onClick={onOpen}><span>{task.id} <i className={'ml-priority-dot '+(task.priority.startsWith('P1')?'urgent':'')}/>{task.priority.split(' ').slice(0,2).join(' ')}</span><strong>{task.title}</strong><small>{task.lead}</small><span className="ml-category-badge">{categoryForSection(task.section).label}</span></button><span className={progressClass(task.status)}>{statusLabels[task.status]}</span><span className="ml-task-date"><CalendarDays size={15}/>{formatDate(task.dueDate)}</span>{queued&&<span className="ml-queued" title="Waiting to sync"><CloudOff size={16}/></span>}<button className="ml-task-arrow" aria-label={'Open '+task.title} onClick={onOpen}><ChevronRight size={19}/></button></article>;}
function TaskDrawer({task,editable,saving,queued,onClose,onSave,onRecommend}:{task:MarathonTask;editable:boolean;saving:boolean;queued:boolean;onClose:()=>void;onSave:(x:EditChanges)=>void;onRecommend:()=>void}){
 const [title,setTitle]=useState(task.title),[lead,setLead]=useState(task.lead),[dueDate,setDueDate]=useState(task.dueDate||'');
 const [categorySection,setCategorySection]=useState(isMarathonCategorySection(task.section)?task.section:'');
 const [priority,setPriority]=useState(task.priority),[importance,setImportance]=useState(task.importance),[status,setStatus]=useState<MarathonStatus>(task.status);
 const [completion,setCompletion]=useState(dateTimeLocal(task.completedAt)),[nextStep,setNextStep]=useState(task.nextStep),[evidence,setEvidence]=useState(task.evidence||''),[notes,setNotes]=useState(task.notes||'');
 const [archived,setArchived]=useState(Boolean(task.archived));
 function submit(e:React.FormEvent){e.preventDefault();const changes:EditChanges={title,lead,section:categorySection,dueDate:dueDate||null,priority,importance,status,nextStep,evidence,notes,archived};
  if(status==='done'&&completion&&completion!==dateTimeLocal(task.completedAt))changes.completedAt=new Date(completion).toISOString();
  onSave(changes);
 }
 return <div className="ml-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="ml-drawer" role="dialog" aria-modal="true" aria-label="Action details"><header><div><span className="ml-eyebrow">ACTION DETAILS · {task.id}</span><h2>Task details</h2></div><button onClick={onClose} aria-label="Close details"><X size={22}/></button></header><div className="ml-drawer-content"><span className={progressClass(task.status)}>{statusLabels[task.status]}</span>{queued&&<p className="ml-form-help">This action has edits pending offline synchronisation.</p>}{task.status==='done'&&!task.completedAt&&<p className="ml-form-help">Marked Done in the source checklist. Record the actual completion date when it is known.</p>}<form className="ml-form" id="ml-task-form" onSubmit={submit}><label>Action title<input maxLength={220} value={title} onChange={e=>setTitle(e.target.value)} disabled={!editable} required/></label><label>Category<select required value={categorySection} onChange={e=>setCategorySection(e.target.value)} disabled={!editable}><option value="">Choose a category</option>{marathonCategories.map(c=><option key={c.id} value={c.section}>{c.label}</option>)}</select></label><div className="ml-form-grid"><label>Responsible team<input maxLength={100} value={lead} onChange={e=>setLead(e.target.value)} disabled={!editable} required/></label><label>Due date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} disabled={!editable}/></label></div><label>Status<select value={status} onChange={e=>setStatus(e.target.value as MarathonStatus)} disabled={!editable}>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>{status==='done'&&<label>Actual completion date and time (backdating allowed)<input type="datetime-local" value={completion} onChange={e=>setCompletion(e.target.value)} disabled={!editable}/><small className="ml-form-help">The audit log records the entry time separately from the actual completion date.</small></label>}<label>Next step<textarea rows={3} value={nextStep} onChange={e=>setNextStep(e.target.value)} disabled={!editable}/></label><label>Evidence or reference<textarea rows={3} value={evidence} placeholder="Meeting minutes, letter reference, document location or other verifiable evidence" onChange={e=>setEvidence(e.target.value)} disabled={!editable}/></label><details className="ml-task-more" open={task.archived||undefined}><summary>{editable?'More details and archive':'More details'}</summary><div className="ml-extra-fields"><div className="ml-form-grid"><label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)} disabled={!editable}><option>P1 Act now</option><option>P2 Next 30 days</option><option>P3 Schedule</option></select></label><label>Importance<select value={importance} onChange={e=>setImportance(e.target.value)} disabled={!editable}>{['Critical','High','Medium','Low'].map(x=><option key={x}>{x}</option>)}</select></label></div><label>Internal notes<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} disabled={!editable}/></label><div className="ml-meta-line">Dependencies: {task.dependencies?.join(', ')||'None'} · Last update: {formatDate(task.updatedAt)}</div>{editable&&<label className="ml-checkbox-row"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/> Archive this record (recoverable)</label>}{task.sourceRow&&<p className="ml-form-help">Source checklist row {task.sourceRow}</p>}{task.dateCorrection&&<p className="ml-form-help">Source deadline: {task.sourceDeadline}. {task.dateCorrection}</p>}</div></details></form></div><footer><button className="ml-secondary" onClick={onRecommend}><MessageSquarePlus size={16}/> Recommend change</button>{editable?<button className="ml-primary" type="submit" form="ml-task-form" disabled={saving}>{saving?'Saving…':'Save changes'}<Check size={17}/></button>:<button className="ml-primary" onClick={onClose}>Close</button>}</footer></section></div>;
}
function NewTaskModal({saving,onClose,onSave,initialSection=''}:{saving:boolean;initialSection?:string;onClose:()=>void;onSave:(x:{title:string;lead:string;section:string;dueDate:string|null;priority:string;importance:string;nextStep:string;notes:string})=>void}){
 const [categorySection,setCategorySection]=useState(initialSection);
 const [title,setTitle]=useState(''),[lead,setLead]=useState(''),[dueDate,setDueDate]=useState(''),[priority,setPriority]=useState('P2 Next 30 days'),[importance,setImportance]=useState('High'),[nextStep,setNextStep]=useState(''),[notes,setNotes]=useState('');
 return <div className="ml-modal-backdrop"><section className="ml-drawer" role="dialog" aria-modal="true" aria-label="Create new action"><header><div><span className="ml-eyebrow">NEW ACTION</span><h2>Add a checklist action</h2></div><button onClick={onClose} aria-label="Close"><X/></button></header><div className="ml-drawer-content"><form id="ml-new-form" className="ml-form" onSubmit={e=>{e.preventDefault();onSave({title,lead,section:categorySection,dueDate:dueDate||null,priority,importance,nextStep,notes});}}><label>Action title<input required minLength={3} maxLength={220} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Category<select required value={categorySection} onChange={e=>setCategorySection(e.target.value)}><option value="">Choose a category</option>{marathonCategories.map(c=><option key={c.id} value={c.section}>{c.label}</option>)}</select></label><label>Responsible team<input required minLength={2} maxLength={100} value={lead} onChange={e=>setLead(e.target.value)}/></label><label>Target date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label>Next action<textarea rows={3} value={nextStep} onChange={e=>setNextStep(e.target.value)}/></label><details className="ml-task-more"><summary>Optional details</summary><div className="ml-extra-fields"><label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}><option>P1 Act now</option><option>P2 Next 30 days</option><option>P3 Schedule</option></select></label><label>Importance<select value={importance} onChange={e=>setImportance(e.target.value)}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label><label>Notes<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label></div></details></form></div><footer><button className="ml-secondary" onClick={onClose}>Cancel</button><button className="ml-primary" disabled={saving} type="submit" form="ml-new-form">Create action <Plus size={17}/></button></footer></section></div>;
}
