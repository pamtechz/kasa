'use client';
export type PendingEdit={key:string;uid:string;taskId:string;expectedRevision:number;mutationId:string;changes:Record<string,unknown>;queuedAt:string};
type Snapshot={key:string;uid:string;data:unknown;at:string};
const NAME='kasa-marathon-offline-v1';
const VERSION=1;
function request<T>(r:IDBRequest<T>):Promise<T>{
 return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
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
async function store<T>(name:'snapshots'|'pending',mode:IDBTransactionMode,cb:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const d=await db();
 try{const tx=d.transaction(name,mode);return await request(cb(tx.objectStore(name)));}
 finally{d.close();}
}
export async function readMarathonCache(uid:string):Promise<Snapshot|null>{
 try{return await store('snapshots','readonly',s=>s.get(uid))||null;}catch{return null;}
}
export async function saveMarathonCache(uid:string,data:unknown){
 await store('snapshots','readwrite',s=>s.put({key:uid,uid,data,at:new Date().toISOString()}));
}
export async function pendingMarathonEdits(uid:string):Promise<PendingEdit[]>{
 try{return (await store('pending','readonly',s=>s.getAll())||[]).filter(x=>x.uid===uid);}
 catch{return [];}
}
export async function queueMarathonEdit(uid:string,taskId:string,expectedRevision:number,changes:Record<string,unknown>,mutationId=crypto.randomUUID()){
 const key=uid+':'+taskId;
 const existing=await store<PendingEdit|undefined>('pending','readonly',s=>s.get(key));
 const item:PendingEdit={
  key,uid,taskId,expectedRevision:existing?.expectedRevision??expectedRevision,
  mutationId:existing?crypto.randomUUID():mutationId,
  changes:{...(existing?.changes||{}),...changes},queuedAt:new Date().toISOString()
 };
 // A pending mutation ID never changes its meaning: subsequent offline edits
 // generate a new ID for the merged operation before it has been submitted.
 await store('pending','readwrite',s=>s.put(item));
 return item;
}
export async function removeMarathonEdit(key:string){await store('pending','readwrite',s=>s.delete(key));}
