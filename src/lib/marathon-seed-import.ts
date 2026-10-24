import {createHash} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';

type RecordData=Record<string,unknown>;
type SeedTask=RecordData&{id:string;title:string;lead:string;dueDate:string|null;status:string};
export type ChecklistSeed={version:string;sourceName:string;sourceSha256:string;eventDate:string;venue:string;seededFrom:string;sections:string[];approvedDateCorrection:{count:number};items:SeedTask[]};
type LegacySeed={items:SeedTask[]};
export type MarathonSeedInfo={version:string;sourceName:string;itemCount:number;sectionCount:number;correctedDateCount:number;completedCount:number;eventDate:string;venue:string};
type Change={id:string;kind:'created'|'updated'|'archived';before:RecordData|null;after:RecordData};
export class ChecklistImportError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const FAMILY='kasa-life-marathon-2027';
const referenceFields=['title','lead','dueDate','section'] as const;
function baseline(task:SeedTask){return {title:task.title,lead:task.lead,dueDate:task.dueDate,status:task.status,section:task.section};}
function isLegacyRecord(record:RecordData){return record.origin==='Document'||record.origin==='Added';}
function canonical(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
 return value;
}
export function checklistSourceInfo(seed:ChecklistSeed):MarathonSeedInfo{
 return {version:seed.version,sourceName:seed.sourceName,itemCount:seed.items.length,sectionCount:seed.sections.length,correctedDateCount:seed.approvedDateCorrection.count,completedCount:seed.items.filter(t=>t.status==='done').length,eventDate:seed.eventDate,venue:seed.venue};
}
export function planChecklistImport(seed:ChecklistSeed,legacy:LegacySeed,records:RecordData[],meta:RecordData|null,actor:string,now:string){
 if(!/^[a-zA-Z0-9-]{1,100}$/.test(seed.version)||!seed.items.length||seed.items.length>250||new Set(seed.items.map(t=>t.id)).size!==seed.items.length||seed.items.some(t=>!/^T\d{3}$/.test(t.id)||!t.title||!t.lead||!['todo','done'].includes(t.status)||!seed.sections.includes(String(t.section))))throw new ChecklistImportError(500,'The source checklist failed validation.');
 const old=new Map(legacy.items.map(t=>[t.id,t]));
 const sourceIds=new Set(seed.items.map(t=>t.id));
 const relevant=records.filter(r=>sourceIds.has(String(r.id))||r.sourceChecklist===FAMILY||(old.has(String(r.id))&&isLegacyRecord(r)));
 const planHash=createHash('sha256').update(JSON.stringify(canonical({source:seed,previousVersion:meta?.version??null,records:[...relevant].sort((a,b)=>String(a.id).localeCompare(String(b.id)))}))).digest('hex');
 const existing=new Map(records.map(t=>[String(t.id),t]));
 const changes:Change[]=[];
 const preservedFields:{id:string;fields:string[]}[]=[];
 if(meta?.version!==seed.version){
  for(const task of seed.items){
   const current=existing.get(task.id);
   const provenance={sourceChecklist:FAMILY,sourceVersion:seed.version,sourceSnapshot:baseline(task),sourceRetired:false,sourceRow:task.sourceRow,sourceDeadline:task.sourceDeadline,sourceRemarks:task.sourceRemarks,dateBasis:task.dateBasis,dateCorrection:task.dateCorrection??null,cadence:task.cadence};
   if(!current){
    changes.push({id:task.id,kind:'created',before:null,after:{...task,...provenance,revision:1,archived:false,completedAt:null,completedBy:null,recordedAt:task.status==='done'?now:null,updatedAt:now,updatedBy:actor}});
    continue;
   }
   const previous=current.sourceChecklist===FAMILY?current.sourceSnapshot as RecordData|undefined:old.has(task.id)&&isLegacyRecord(current)?old.get(task.id):undefined;
   if(!previous)throw new ChecklistImportError(409,'Source ID '+task.id+' is occupied by an unrecognised record. No data was imported.');
   const previousValues={...previous};
   if(current.sourceChecklist===FAMILY&&!Object.prototype.hasOwnProperty.call(previousValues,'section'))previousValues.section=current.section;
   if(!Number.isSafeInteger(current.revision)||Number(current.revision)<1)throw new ChecklistImportError(409,'Review the invalid revision on '+task.id+' before importing.');
   const after:RecordData={...current,...provenance,revision:Number(current.revision)+1,updatedAt:now,updatedBy:actor};
   const retained:string[]=[];
   for(const field of referenceFields){
    if(current[field]===previousValues[field])after[field]=task[field];
    else if(current[field]!==task[field])retained.push(field);
   }
   // A Done remark supplies status, not the actual completion timestamp.
   // Live progress is retained; only pristine records take the supplied status.
   if(task.status==='done'&&current.status==='todo'&&current.revision===1&&!current.completedAt&&!current.recordedAt&&!current.notes&&!current.evidence&&!current.archived){
    Object.assign(after,{status:'done',completedAt:null,completedBy:null,recordedAt:now});
   }
   if(retained.length)preservedFields.push({id:task.id,fields:retained});
   changes.push({id:task.id,kind:'updated',before:current,after});
  }
  for(const current of relevant){
   const id=String(current.id);
   if(sourceIds.has(id)||current.archived||current.sourceRetired===true)continue;
   if(!Number.isSafeInteger(current.revision)||Number(current.revision)<1)throw new ChecklistImportError(409,'Review the invalid revision on '+id+' before importing.');
   changes.push({id,kind:'archived',before:current,after:{...current,archived:true,sourceRetired:true,sourceRetiredByVersion:seed.version,revision:Number(current.revision)+1,updatedAt:now,updatedBy:actor}});
  }
 }
 // Recovery snapshots and task changes must fit one atomic transaction.
 if(changes.reduce((n,c)=>n+1+(c.before?1:0),3)>500)throw new ChecklistImportError(409,'This import exceeds the atomic write limit. No data was imported.');
 return {version:seed.version,sourceName:seed.sourceName,planHash,previousVersion:meta?.version??null,alreadyImported:meta?.version===seed.version,totalSourceItems:seed.items.length,created:changes.filter(c=>c.kind==='created').length,updated:changes.filter(c=>c.kind==='updated').length,archived:changes.filter(c=>c.kind==='archived').length,preservedFields,changes};
}
export async function previewChecklistImport(db:Firestore,seed:ChecklistSeed,legacy:LegacySeed,actor:string){
 const [tasks,meta]=await Promise.all([db.collection('marathonTasks').get(),db.collection('marathonMeta').doc('source').get()]);
 const {changes,...preview}=planChecklistImport(seed,legacy,tasks.docs.map(d=>({...d.data(),id:d.id})),meta.data()??null,actor,new Date().toISOString());
 void changes;
 return preview;
}
export async function applyChecklistImport(db:Firestore,seed:ChecklistSeed,legacy:LegacySeed,actor:string,expectedPlanHash:string){
 return db.runTransaction(async tx=>{
  const metaRef=db.collection('marathonMeta').doc('source');
  const historyRef=db.collection('marathonImports').doc(seed.version);
  const [tasks,meta,history]=await Promise.all([tx.get(db.collection('marathonTasks')),tx.get(metaRef),tx.get(historyRef)]);
  const now=new Date().toISOString();
  const {changes,...result}=planChecklistImport(seed,legacy,tasks.docs.map(d=>({...d.data(),id:d.id})),meta.data()??null,actor,now);
  if(result.alreadyImported)return result;
  if(history.exists)throw new ChecklistImportError(409,'This checklist version was already applied and another source version is active. Refresh the application.');
  if(result.planHash!==expectedPlanHash)throw new ChecklistImportError(409,'The checklist changed after review. Review the import again before applying it.');
  for(const change of changes){
   const ref=db.collection('marathonTasks').doc(change.id);
   if(change.before){
    tx.create(historyRef.collection('before').doc(change.id),{task:change.before,action:change.kind,at:now});
    tx.set(ref,change.after);
   }else tx.create(ref,change.after);
  }
  tx.create(historyRef,{...result,sourceSha256:seed.sourceSha256,previousMeta:meta.data()??null,at:now,actor});
  tx.set(metaRef,{...checklistSourceInfo(seed),totalSourceItems:seed.items.length,sourceSha256:seed.sourceSha256,seededFrom:seed.seededFrom,created:result.created,updated:result.updated,archived:result.archived,importedAt:now,importedBy:actor});
  tx.create(db.collection('marathonAudit').doc('import-'+seed.version),{action:'source.imported',actor,at:now,changes:{version:seed.version,created:result.created,updated:result.updated,archived:result.archived,preservedRecords:result.preservedFields.length}});
  return result;
 });
}
