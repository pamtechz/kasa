import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {completionChanges,preserveSourceCategory} from '../../src/lib/marathon-task-update.ts';
import {marathonCategories,isMarathonCategorySection} from '../../src/lib/marathon-categories.ts';
import {z} from 'zod';

class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const fixtures={};
async function loadModule(path,bindings){
 const name='marathon-fixture-'+Object.keys(fixtures).length;fixtures[name]=bindings;
 globalThis.__marathonReliabilityFixtures=fixtures;
 const source=stripTypeScriptTypes(readFileSync(new URL('../../'+path,import.meta.url),'utf8'),{mode:'strip'}).replace(/^import .*?;\s*$/gm,'');
 const imports='const {'+Object.keys(bindings).join(',')+'}=globalThis.__marathonReliabilityFixtures['+JSON.stringify(name)+'];\n';
 return import('data:text/javascript;base64,'+Buffer.from(imports+source).toString('base64'));
}

const records=[];
class Query{
 constructor(filters=[],cursor=null,max=Infinity){Object.assign(this,{filters,cursor,max});}
 orderBy(){return this;}
 where(field,op,value){assert.equal(op,'==');return new Query([...this.filters,[field,value]],this.cursor,this.max);}
 startAfter(cursor){return new Query(this.filters,cursor,this.max);}
 limit(max){return new Query(this.filters,this.cursor,max);}
 async get(){
  const docs=records.filter(r=>this.filters.every(([k,v])=>r[k]===v)&&(!this.cursor||r.id>this.cursor)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,this.max).map(r=>({id:r.id,data:()=>r}));
  return {docs,size:docs.length};
 }
}
const pagination=await loadModule('src/lib/marathon-suggestions.ts',{
 db:{collection:name=>{assert.equal(name,'marathonSuggestions');return new Query();}},
 FieldPath:{documentId:()=> '__name__'},HttpError,canReview:role=>role!=='kasaClient'
});
const reviewer={uid:'coordinator',role:'kasaReviewer'};

test('reviewers can page through more than 200 pending recommendations exactly once',async()=>{
 records.length=0;
 for(let i=1;i<=247;i++)records.unshift({id:'suggestion-'+String(i).padStart(4,'0'),status:i%10===0?'accepted':'pending',createdBy:i%2?'alice':'bob'});
 let cursor=null;const ids=[];
 do{
  const page=await pagination.marathonSuggestionsPage(reviewer,'pending',cursor);
  assert.ok(page.suggestions.length<=50);
  assert.ok(page.suggestions.every(s=>s.status==='pending'));
  ids.push(...page.suggestions.map(s=>s.id));cursor=page.nextSuggestionCursor;
 }while(cursor);
 const expected=records.filter(s=>s.status==='pending').map(s=>s.id).sort();
 assert.deepEqual(ids,expected);
 assert.equal(new Set(ids).size,223);
 const accepted=await pagination.marathonSuggestionsPage(reviewer,'accepted');
 assert.equal(accepted.suggestions.length,24);
});
test('a client cursor or requested review status cannot expose another account recommendations',async()=>{
 const first=await pagination.marathonSuggestionsPage({uid:'alice',role:'kasaClient'},'all');
 const next=await pagination.marathonSuggestionsPage({uid:'alice',role:'kasaClient'},'accepted',first.nextSuggestionCursor);
 for(const page of [first,next])assert.ok(page.suggestions.every(s=>s.createdBy==='alice'));
 await assert.rejects(pagination.marathonSuggestionsPage(reviewer,'forged'),e=>e.status===400);
 await assert.rejects(pagination.marathonSuggestionsPage(reviewer,'pending','../other'),e=>e.status===400);
});

const store=new Map();
const db={
 collection(name){return {doc(id){return {key:name+'/'+id,async get(){const data=store.get(this.key);return {exists:!!data,data:()=>structuredClone(data)};}};}};},
 async runTransaction(run){
  const writes=[];
  await run({get:ref=>ref.get(),update:(ref,data)=>writes.push([ref.key,{...store.get(ref.key),...data}]),create:(ref,data)=>{assert.equal(store.has(ref.key),false);writes.push([ref.key,data]);}});
  for(const [key,value]of writes)store.set(key,structuredClone(value));
 }
};
const actor={uid:'editor',role:'kasaEditor'};
const route=await loadModule('src/app/api/marathon/tasks/[id]/route.ts',{
 db,z,HttpError,completionChanges,preserveSourceCategory,isMarathonCategorySection,
 marathonIdentity:async req=>{if(!req.headers.has('authorization'))throw new HttpError(401,'Sign in first.');return actor;},
 requireMarathon:identity=>{if(identity.role==='kasaClient')throw new HttpError(403,'View only.');},
 sameOrigin:()=>{},json:(body,status=200)=>Response.json(body,{status}),fail:error=>Response.json({error:error.message},{status:error.status||500})
});
const context={params:Promise.resolve({id:'T001'})};
function request(changes,revision=1,id=crypto.randomUUID()){
 return new Request('https://school.test/api/marathon/tasks/T001',{method:'PATCH',headers:{authorization:'Bearer test-only'},body:JSON.stringify({expectedRevision:revision,mutationId:id,changes})});
}
const original={id:'T001',title:'Confirm event venue',revision:1,status:'done',completedAt:'2026-10-20T09:00:37.000Z',completedBy:'first-editor',recordedAt:'2026-10-21T10:00:00.000Z'};

test('the real task PATCH preserves attribution and returns the committed revision on idempotent retry',async()=>{
 store.clear();store.set('marathonTasks/T001',original);
 const id=crypto.randomUUID();const payload={status:'done',notes:'Meeting minutes added'};
 const response=await route.PATCH(request(payload,1,id),context);
 assert.equal(response.status,200);
 const saved=await response.json();
 assert.equal(saved.task.completedBy,'first-editor');assert.equal(saved.task.recordedAt,original.recordedAt);
 assert.equal(saved.appliedRevision,2);
 store.set('marathonTasks/T001',{...saved.task,revision:3,notes:'Another coordinator edited later'});
 const retry=await route.PATCH(request(payload,1,id),context);
 const retried=await retry.json();
 assert.equal(retry.status,200);assert.equal(retried.task.revision,3);assert.equal(retried.appliedRevision,2);
 assert.equal(store.size,2);
});
test('the real PATCH rejects stale changes and viewer writes, while GET permits authorized viewing',async()=>{
 store.clear();store.set('marathonTasks/T001',{...original,revision:3});
 const stale=await route.PATCH(request({notes:'Stale'},1),context);
 assert.equal(stale.status,409);assert.equal(store.get('marathonTasks/T001').notes,undefined);
 actor.role='kasaClient';
 assert.equal((await route.PATCH(request({notes:'Forbidden'},3),context)).status,403);
 assert.equal((await route.GET(new Request('https://school.test/api/marathon/tasks/T001',{headers:{authorization:'Bearer test-only'}}),context)).status,200);
 assert.equal((await route.GET(new Request('https://school.test/api/marathon/tasks/T001'),context)).status,401);
 actor.role='kasaEditor';
});

test('the real PATCH validates categories, records the prior category and preserves completion attribution',async()=>{
 store.clear();
 const section=marathonCategories[0].section,target=marathonCategories[12].section;
 store.set('marathonTasks/T001',{...original,section,sourceSnapshot:{title:original.title,lead:'Team',dueDate:null,status:'done'}});
 const invalid=await route.PATCH(request({section:'Unknown category'}),context);
 assert.equal(invalid.status,400);assert.equal(store.get('marathonTasks/T001').section,section);
 const mutation=crypto.randomUUID();
 const response=await route.PATCH(request({section:target},1,mutation),context);
 assert.equal(response.status,200);
 const {task}=await response.json();
 assert.equal(task.section,target);assert.equal(task.sourceSnapshot.section,section);
 assert.equal(task.completedAt,original.completedAt);assert.equal(task.completedBy,original.completedBy);
 assert.equal(task.recordedAt,original.recordedAt);
 const audit=store.get('marathonAudit/'+mutation);
 assert.equal(audit.before.section,section);assert.equal(audit.changes.section,target);
});
test('the real create endpoint requires a known category and still enforces edit access',async()=>{
 const saved=[];
 const createRoute=await loadModule('src/app/api/marathon/tasks/route.ts',{
  z,HttpError,isMarathonCategorySection,randomUUID:()=>crypto.randomUUID(),
  db:{collection:name=>({doc:id=>({path:name+'/'+(id||crypto.randomUUID())})}),
   batch:()=>({create:(ref,value)=>saved.push({path:ref.path,value}),commit:async()=>{}})},
  marathonIdentity:async()=>actor,
  requireMarathon:identity=>{if(identity.role==='kasaClient')throw new HttpError(403,'View only.');},
  sameOrigin:()=>{},json:(body,status=200)=>Response.json(body,{status}),
  fail:error=>Response.json({error:error.message},{status:error.status||500})
 });
 const post=section=>createRoute.POST(new Request('https://school.test/api/marathon/tasks',{
  method:'POST',body:JSON.stringify({title:'Confirm the category lead',lead:'KASA Team',section})
 }));
 for(const section of [undefined,'','Other']){
  const response=await post(section);
  assert.equal(response.status,400);assert.match((await response.json()).error,/category/);
 }
 assert.equal(saved.length,0);
 const section=marathonCategories[4].section,response=await post(section);
 assert.equal(response.status,201);assert.equal((await response.json()).task.section,section);
 assert.equal(saved.length,2);assert.equal(saved[0].value.section,section);
 actor.role='kasaClient';
 try{assert.equal((await post(section)).status,403);}
 finally{actor.role='kasaEditor';}
 assert.equal(saved.length,2);
});
