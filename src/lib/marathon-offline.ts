'use client';
export type SubmittedEdit={expectedRevision:number;mutationId:string;changes:Record<string,unknown>};
export type PendingEdit=SubmittedEdit&{
 key:string;uid:string;taskId:string;queuedAt:string;submitted?:SubmittedEdit;conflict?:string;
};
type Snapshot={key:string;uid:string;data:unknown;at:string};
const NAME='kasa-marathon-offline-v1';
const VERSION=1;
async function db():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(NAME,VERSION);
  r.onupgradeneeded=()=>{
   const d=r.result;
   if(!d.objectStoreNames.contains('snapshots'))d.createObjectStore('snapshots',{keyPath:'key'});
   if(!d.objectStoreNames.contains('pending'))d.createObjectStore('pending',{keyPath:'key'});
  };
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 });
}
// Wait for commit: a successful request can still be rolled back by quota errors.
async function transaction<T>(name:'snapshots'|'pending',mode:IDBTransactionMode,run:(s:IDBObjectStore,done:(value:T)=>void)=>void):Promise<T>{
 const d=await db();
 try{
  return await new Promise<T>((resolve,reject)=>{
   const tx=d.transaction(name,mode);let result:T;
   tx.oncomplete=()=>resolve(result);
   tx.onabort=()=>reject(tx.error||new Error('Offline storage could not commit the change.'));
   tx.onerror=()=>reject(tx.error||new Error('Offline storage is unavailable.'));
   try{run(tx.objectStore(name),value=>{result=value;});}
   catch(e){tx.abort();reject(e);}
  });
 }finally{d.close();}
}
function read<T>(name:'snapshots'|'pending',key?:string):Promise<T>{
 return transaction(name,'readonly',(s,done)=>{
  const r=key===undefined?s.getAll():s.get(key);r.onsuccess=()=>done(r.result as T);
 });
}
// One read/merge/write transaction also protects edits made in another tab.
function updatePending<T>(key:string,change:(current:PendingEdit|undefined)=>{item?:PendingEdit;result:T}):Promise<T>{
 return transaction('pending','readwrite',(s,done)=>{
  const r=s.get(key);
  r.onsuccess=()=>{
   const next=change(r.result as PendingEdit|undefined);
   if(next.item)s.put(next.item);else s.delete(key);
   done(next.result);
  };
 });
}
export async function readMarathonCache(uid:string):Promise<Snapshot|null>{
 try{return await read<Snapshot>('snapshots',uid)||null;}catch{return null;}
}
export async function saveMarathonCache(uid:string,data:unknown){
 await transaction('snapshots','readwrite',(s,done)=>{
  s.put({key:uid,uid,data,at:new Date().toISOString()});done(undefined);
 });
}
export async function pendingMarathonEdits(uid:string):Promise<PendingEdit[]>{
 return (await read<PendingEdit[]>('pending')).filter(x=>x.uid===uid).sort((a,b)=>a.queuedAt.localeCompare(b.queuedAt));
}
export async function queueMarathonEdit(uid:string,taskId:string,expectedRevision:number,changes:Record<string,unknown>,mutationId:string=crypto.randomUUID()){
 const key=uid+':'+taskId;
 return updatePending(key,existing=>{
  const item:PendingEdit={
   ...existing,key,uid,taskId,expectedRevision:existing?.expectedRevision??expectedRevision,
   mutationId:existing?crypto.randomUUID():mutationId,
   changes:{...(existing?.changes||{}),...changes},queuedAt:existing?.queuedAt||new Date().toISOString()
  };
  return {item,result:item};
 });
}
export async function claimMarathonEdit(key:string):Promise<PendingEdit|null>{
 return updatePending(key,current=>{
  if(!current||current.conflict)return {item:current,result:null};
  // Persist the exact request before sending. A lost response or reload retries
  // that immutable mutation ID even after another local edit to the same task.
  const submitted=current.submitted||{expectedRevision:current.expectedRevision,mutationId:current.mutationId,changes:current.changes};
  return {item:{...current,submitted},result:{...current,...submitted}};
 });
}
export async function acknowledgeMarathonEdit(sent:PendingEdit,appliedRevision:number){
 return updatePending(sent.key,current=>{
  if(!current||current.submitted?.mutationId!==sent.mutationId)return {item:current,result:false};
  if(current.mutationId===sent.mutationId)return {result:true};
  const changes=Object.fromEntries(Object.entries(current.changes).filter(([k,v])=>v!==sent.changes[k]));
  if(!Object.keys(changes).length)return {result:true};
  const item={...current,changes,expectedRevision:appliedRevision};
  delete item.submitted;delete item.conflict;
  return {item,result:true};
 });
}
export async function flagMarathonConflict(sent:PendingEdit,message:string){
 return updatePending(sent.key,current=>{
  if(!current||current.submitted?.mutationId!==sent.mutationId)return {item:current,result:false};
  const item={...current,conflict:message};delete item.submitted;
  return {item,result:true};
 });
}
export async function resolveMarathonEdit(edit:PendingEdit,revision?:number){
 return updatePending(edit.key,current=>{
  if(!current||current.mutationId!==edit.mutationId||current.submitted)return {item:current,result:false};
  if(revision===undefined)return {result:true};
  const item={...current,expectedRevision:revision,mutationId:crypto.randomUUID()};delete item.conflict;
  return {item,result:true};
 });
}
