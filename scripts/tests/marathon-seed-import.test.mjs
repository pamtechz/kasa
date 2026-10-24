import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {planChecklistImport,previewChecklistImport,applyChecklistImport,ChecklistImportError} from '../../src/lib/marathon-seed-import.ts';
const seed=JSON.parse(readFileSync(new URL('../../src/data/marathon-seed.json',import.meta.url),'utf8'));
const legacy=JSON.parse(readFileSync(new URL('../../src/data/marathon-seed-2026-10-23.json',import.meta.url),'utf8'));
const now='2026-10-24T18:00:00.000Z';
const oldRecords=()=>legacy.items.map(x=>({...x,revision:1,archived:false,updatedAt:now,updatedBy:'previous-importer'}));

test('the operator seed job requires an explicit mode, source version, matching live project and reviewed fingerprint',()=>{
 const script=fileURLToPath(new URL('../seed-marathon.mjs',import.meta.url));
 const env={...process.env,FIREBASE_PROJECT_ID:undefined,FIREBASE_CLIENT_EMAIL:undefined,FIREBASE_PRIVATE_KEY:undefined,NEXT_PUBLIC_FIREBASE_PROJECT_ID:undefined};
 for(const args of [[],['--apply','--expected-project=unconfigured','--source-version='+seed.version],['--dry-run','--expected-project=unconfigured','--source-version='+seed.version]]){
  const run=spawnSync(process.execPath,['--experimental-strip-types',script,...args],{encoding:'utf8',env});
  assert.equal(run.status,1);assert.match(run.stderr,/Use --dry-run|configured school Firebase project/);assert.equal(run.stdout.includes('MARATHON_DATABASE'),false);
 }
});

test('empty database imports the complete document and never invents completion dates',()=>{
 const plan=planChecklistImport(seed,legacy,[],null,'super',now);
 assert.equal(plan.created,186);assert.equal(plan.updated,0);assert.equal(plan.archived,0);
 const done=plan.changes.filter(x=>x.after.status==='done');
 assert.equal(done.length,5);
 for(const {after} of done){assert.equal(after.completedAt,null);assert.equal(after.completedBy,null);assert.equal(after.recordedAt,now);}
 assert.deepEqual(seed.items.map(x=>x.sourceRow),Array.from({length:186},(_,i)=>i+1));
 assert.equal(seed.items.filter(x=>x.sourceDeadline==='Ongoing'&&x.dueDate===null).length,13);
 for(const task of seed.items.filter(x=>x.dateCorrection)){assert.match(task.sourceDeadline,/2026$/);assert.match(task.dueDate,/^2027-/);}
 assert.equal(seed.items.find(x=>x.sourceRow===19).dueDate,'2027-03-22');
});
test('legacy upgrade retains 85 IDs and archives 45 superseded rows without deletion',()=>{
 const records=oldRecords();
 const plan=planChecklistImport(seed,legacy,records,{created:130},'super',now);
 assert.equal(plan.created,101);assert.equal(plan.updated,85);assert.equal(plan.archived,45);
 const result=new Map(records.map(t=>[t.id,t]));
 for(const c of plan.changes)result.set(c.id,c.after);
 assert.equal([...result.values()].filter(t=>!t.archived).length,186);
 assert.equal(result.size,231);
 for(const c of plan.changes.filter(c=>c.before))assert.deepEqual(c.before,records.find(t=>t.id===c.id));
 assert.equal(result.get('WEB-01').archived,true);
 assert.equal(result.get('T001').status,'done');
});
test('edited deadlines, titles, completion attribution and private working notes survive an update',()=>{
 const records=oldRecords();const task=records.find(t=>t.id==='T001');
 Object.assign(task,{revision:4,title:'Board-confirmed wording',dueDate:'2026-11-04',status:'done',completedAt:'2026-10-22T10:12:37.000Z',completedBy:'coordinator',recordedAt:'2026-10-23T09:00:00.000Z',notes:'Retain meeting notes',evidence:'Minutes reference 42'});
 const custom={id:'M-personal',title:'Additional user action',revision:3,notes:'Keep',archived:false};records.push(custom);
 const plan=planChecklistImport(seed,legacy,records,null,'super',now);
 const after=plan.changes.find(c=>c.id==='T001').after;
 for(const field of ['title','dueDate','status','completedAt','completedBy','recordedAt','notes','evidence'])assert.equal(after[field],task[field],field);
 assert.equal(after.lead,'Zambia Athletics');
 assert.equal(after.revision,5);
 assert.deepEqual(plan.preservedFields.find(x=>x.id==='T001').fields,['title','dueDate']);
 assert.equal(plan.changes.some(c=>c.id===custom.id),false);
});
test('an occupied new ID halts the import rather than overwriting an unrelated task',()=>{
 const id=seed.items.find(x=>!legacy.items.some(t=>t.id===x.id)).id;
 assert.throws(()=>planChecklistImport(seed,legacy,[{id,title:'Unrelated task',revision:1}],null,'super',now),e=>e.status===409);
});
test('an explicitly restored retired task remains active on the next source update',()=>{
 const first=planChecklistImport(seed,legacy,oldRecords(),null,'super',now);
 const records=first.changes.map(c=>c.after);
 const restored=records.find(t=>t.id==='WEB-01');
 Object.assign(restored,{archived:false,revision:3,notes:'Intentionally restored by the team'});
 const next=planChecklistImport({...seed,version:'next-source'},legacy,records,{version:seed.version},'super',now);
 assert.equal(next.changes.some(c=>c.id==='WEB-01'),false);
 assert.equal(restored.archived,false);
});
test('review fingerprints detect edits and source changes, but ignore query ordering',()=>{
 const records=oldRecords();const plan=planChecklistImport(seed,legacy,records,null,'super',now);
 assert.equal(planChecklistImport(seed,legacy,[...records].reverse(),null,'super','later').planHash,plan.planHash);
 const changed=structuredClone(records);changed[0].notes='Concurrent update';
 assert.notEqual(planChecklistImport(seed,legacy,changed,null,'super',now).planHash,plan.planHash);
 const changedSeed=structuredClone(seed);changedSeed.items[0].lead='Updated organiser';
 assert.notEqual(planChecklistImport(changedSeed,legacy,records,null,'super',now).planHash,plan.planHash);
});

function fakeDb(initial=[],meta=null){
 const store=new Map(initial.map(t=>['marathonTasks/'+t.id,structuredClone(t)]));
 if(meta)store.set('marathonMeta/source',meta);
 const ref=path=>({path,collection:name=>collection(path+'/'+name),get:async()=>snapshot(path)});
 const collection=path=>({path,isCollection:true,doc:id=>ref(path+'/'+id),get:async()=>snapshot(path,true)});
 const snapshot=(path,many=false)=>many?{docs:[...store].filter(([k])=>k.startsWith(path+'/')&&k.slice(path.length+1).indexOf('/')<0).map(([k,v])=>({id:k.split('/').pop(),data:()=>structuredClone(v)}))}:{exists:store.has(path),data:()=>structuredClone(store.get(path))};
 const db={collection,failCommit:false,runTransaction:async fn=>{
  const writes=[];const result=await fn({get:async r=>snapshot(r.path,r.isCollection),set:(r,v)=>writes.push(['set',r.path,v]),create:(r,v)=>writes.push(['create',r.path,v])});
  const next=new Map(store);for(const [kind,path,value] of writes){if(kind==='create'&&next.has(path))throw Error('Already exists');next.set(path,structuredClone(value));}
  if(db.failCommit)throw Error('Simulated commit failure');
  store.clear();for(const [k,v] of next)store.set(k,v);return result;
 }};return {db,store};
}
test('atomic apply saves recovery copies, source history and audit; repeating it is a no-op',async()=>{
 const {db,store}=fakeDb(oldRecords(),{created:130});
 const review=await previewChecklistImport(db,seed,legacy,'super');
 assert.equal('changes' in review,false);
 const result=await applyChecklistImport(db,seed,legacy,'super',review.planHash);
 assert.equal(result.updated,85);
 assert.equal([...store.keys()].filter(k=>k.startsWith('marathonImports/'+seed.version+'/before/')).length,130);
 assert.equal(store.get('marathonMeta/source').version,seed.version);
 assert.equal(store.get('marathonAudit/import-'+seed.version).actor,'super');
 const snapshot=structuredClone([...store]);
 const repeat=await applyChecklistImport(db,seed,legacy,'super',review.planHash);
 assert.equal(repeat.alreadyImported,true);assert.deepEqual([...store],snapshot);
});
test('stale review and commit failure leave all records and metadata intact',async()=>{
 const {db,store}=fakeDb(oldRecords());
 const review=await previewChecklistImport(db,seed,legacy,'super');
 store.set('marathonTasks/T001',{...store.get('marathonTasks/T001'),notes:'Concurrent note',revision:2});
 const snapshot=structuredClone([...store]);
 await assert.rejects(applyChecklistImport(db,seed,legacy,'super',review.planHash),e=>e.status===409);
 assert.deepEqual([...store],snapshot);
 const fresh=await previewChecklistImport(db,seed,legacy,'super');db.failCommit=true;
 await assert.rejects(applyChecklistImport(db,seed,legacy,'super',fresh.planHash),/commit failure/);
 assert.deepEqual([...store],snapshot);
});
test('a stale deployment cannot reapply an already superseded import version',async()=>{
 const {db,store}=fakeDb([],{version:'later-source-version'});
 store.set('marathonImports/'+seed.version,{actor:'super'});
 const review=await previewChecklistImport(db,seed,legacy,'super');
 await assert.rejects(applyChecklistImport(db,seed,legacy,'super',review.planHash),e=>e.status===409);
 assert.equal(store.get('marathonMeta/source').version,'later-source-version');
});
test('both import endpoints reject non-super-admins before any database read or write',async()=>{
 class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
 const bindings={seed,legacy,db:{},HttpError,ChecklistImportError,previewChecklistImport:()=>{throw Error('Must not read');},applyChecklistImport:()=>{throw Error('Must not write');},sameOrigin:()=>{},marathonIdentity:async()=>({uid:'viewer',role:'kasaAdmin'}),requireMarathon:()=>{throw new HttpError(403,'Only the school super administrator can import.');},json:value=>Response.json(value),fail:e=>Response.json({error:e.message},{status:e.status??500})};
 globalThis.__marathonImportFixture=bindings;
 const source=stripTypeScriptTypes(readFileSync(new URL('../../src/app/api/marathon/import/route.ts',import.meta.url),'utf8'),{mode:'strip'}).replace(/^import .*?;\s*$/gm,'');
 const route=await import('data:text/javascript;base64,'+Buffer.from('const {'+Object.keys(bindings).join(',')+'}=globalThis.__marathonImportFixture;\n'+source).toString('base64'));
 assert.equal((await route.GET(new Request('https://school.test/api/marathon/import'))).status,403);
 assert.equal((await route.POST(new Request('https://school.test/api/marathon/import',{method:'POST',body:'{}'}))).status,403);
 delete globalThis.__marathonImportFixture;
});
