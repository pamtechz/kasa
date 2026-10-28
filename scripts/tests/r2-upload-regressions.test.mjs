import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash,createHmac} from 'node:crypto';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
function load(path,stubs={}){
 const source=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 new Function('require','exports',source)(id=>id==='server-only'?{}:
  Object.hasOwn(stubs,id)?stubs[id]:require(id),exports);
 return exports;
}
const credentials={accountId:'a'.repeat(32),bucket:'test-private',jurisdiction:'default',accessKeyId:'test-key',secretAccessKey:'test-secret'};
const {signR2Url}=load('src/lib/r2-signing.ts');
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const errors={HttpError,json:(data,status=200)=>Response.json(data,{status}),
 fail:error=>Response.json({error:error.message},{status:error.status||500})};
const id='00000000-0000-4000-8000-000000000000';
const png=new Uint8Array([137,80,78,71,13,10,26,10]);
const identity={uid:'owner',profile:{role:'student',active:true}};
const storage={storageIdentity:async()=>identity,resolveR2:async()=>credentials};

// Independently reconstruct the server-side signature from the actual request
// headers, rather than trusting X-Amz-SignedHeaders alone.
function signatureFor(url,method,headers){
 const u=new URL(url),query=new URLSearchParams(u.search);
 query.delete('X-Amz-Signature');
 const signed=query.get('X-Amz-SignedHeaders').split(';');
 const h=new Headers(headers);
 const canonicalHeaders=signed.map(name=>name+':'+(name==='host'?u.host:h.get(name)||'')+'\n').join('');
 const encode=s=>encodeURIComponent(s).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
 const qs=[...query.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>encode(k)+'='+encode(v)).join('&');
 const canonical=[method,u.pathname,qs,canonicalHeaders,signed.join(';'),'UNSIGNED-PAYLOAD'].join('\n');
 const scope=query.get('X-Amz-Credential').split('/').slice(1).join('/');
 let key='AWS4'+credentials.secretAccessKey;
 for(const part of scope.split('/'))key=createHmac('sha256',key).update(part).digest();
 return createHmac('sha256',key).update(['AWS4-HMAC-SHA256',query.get('X-Amz-Date'),scope,
  createHash('sha256').update(canonical).digest('hex')].join('\n')).digest('hex');
}

test('PUT signature requires create-once header; removing/changing it invalidates the capability',()=>{
 const url=signR2Url(credentials,'PUT','private/owner/photo.png',180,'image/png');
 const signature=new URL(url).searchParams.get('X-Amz-Signature');
 assert.equal(signatureFor(url,'PUT',{'Content-Type':'image/png','If-None-Match':'*'}),signature);
 assert.notEqual(signatureFor(url,'PUT',{'Content-Type':'image/png'}),signature);
 assert.notEqual(signatureFor(url,'PUT',{'Content-Type':'image/png','If-None-Match':'other'}),signature);
 assert.equal(new URL(signR2Url(credentials,'GET','private/owner/photo.png',90)).searchParams.get('X-Amz-SignedHeaders'),'host');
});

function completion(file,{role='student',appCheck=async()=>{},submissionStatus='submitted'}={}){
 const updates=[];
 const ref={id},submissionRef={id:'submission01'};
 const snapshot=()=>({data:()=>file});
 const submission={formKind:'student',applicantUid:'owner',status:submissionStatus};
 const db={collection:name=>({doc:()=>name==='r2Files'?{...ref,get:async()=>snapshot()}:submissionRef}),
  runTransaction:async callback=>callback({get:async r=>r.id===id?snapshot():{data:()=>submission},
   update:(r,change)=>{updates.push({id:r.id,...change});if(r.id===id)Object.assign(file,change);}})};
 const route=load('src/app/api/r2/uploads/[id]/complete/route.ts',{
  '@/lib/firebase-admin':{db},'@/lib/errors':errors,
  '@/lib/security':{sameOrigin:()=>{},requireAppCheck:appCheck},
  '@/lib/r2-storage':{...storage,storageIdentity:async()=>({...identity,profile:{role}})},
  '@/lib/r2-signing':{signR2Url},'@/lib/intake-server':{loadIntake:async()=>({cdfRequiredDocuments:[{id:'nrc',label:'NRC'}]})}
 });
 return {updates,post:()=>route.POST(new Request('https://kasa.test/api/r2/uploads/'+id+'/complete',{method:'POST'}),{params:Promise.resolve({id})})};
}
const pending=()=>({ownerUid:'owner',connectionId:'platform',key:'private/owner/photo.png',purpose:'profile-photo',
 status:'pending',writeOnce:true,contentType:'image/png',byteSize:8,uploadExpiresAt:new Date(Date.now()+300000).toISOString()});

test('completion refuses older overwriteable pending URLs without touching R2 or metadata',async()=>{
 const file=pending();delete file.writeOnce;
 const fixture=completion(file);
 assert.equal((await fixture.post()).status,409);
 assert.deepEqual(fixture.updates,[]);
});

test('student CDF completion requires App Check before ready retries or object verification',async()=>{
 for(const status of ['pending','ready']){
  const fixture=completion({...pending(),purpose:'cdf-document',submissionId:'submission01',kind:'nrc',status},
   {appCheck:async()=>{throw new HttpError(403,'Application verification is required.');}});
  assert.equal((await fixture.post()).status,403);
  assert.deepEqual(fixture.updates,[]);
 }
});

test('protected completion verifies bytes once and retries preserve approved evidence',async t=>{
 const file={...pending(),purpose:'cdf-document',submissionId:'submission01',kind:'nrc',fileName:'nrc.png'};
 let fetches=0;
 t.mock.method(globalThis,'fetch',async(_url,init)=>{
  fetches++;
  return init.method==='HEAD'?new Response(null,{headers:{'content-length':'8','content-type':'image/png',etag:'"verified"'}}):
   new Response(png,{status:206});
 });
 const fixture=completion(file);
 assert.equal((await fixture.post()).status,200);
 assert.equal(file.status,'ready');
 assert.equal(fixture.updates.length,2);
 const firstDocument=fixture.updates[0]['documents.nrc'];
 assert.equal(firstDocument.verifiedAt,null);
 assert.equal(firstDocument.r2FileId,id);
 assert.equal((await fixture.post()).status,200);
 assert.equal(fetches,2);
 assert.equal(fixture.updates.length,2);
});

test('financially locked CDF records cannot attach completed evidence',async t=>{
 t.mock.method(globalThis,'fetch',async(_url,init)=>init.method==='HEAD'?
  new Response(null,{headers:{'content-length':'8','content-type':'image/png'}}):new Response(png,{status:206}));
 const fixture=completion({...pending(),purpose:'cdf-document',submissionId:'submission01',kind:'nrc'},
  {submissionStatus:'cdf_funds_received'});
 assert.equal((await fixture.post()).status,409);
 assert.deepEqual(fixture.updates,[]);
});

test('student CDF initiation enforces App Check before granting a platform upload',async()=>{
 const created=[];
 const route=load('src/app/api/r2/uploads/route.ts',{
  '@/lib/firebase-admin':{db:{collection:()=>({doc:()=>({create:async value=>created.push(value)})})}},
  '@/lib/errors':errors,'@/lib/security':{sameOrigin:()=>{},rateLimit:async()=>{},
   requireAppCheck:async()=>{throw new HttpError(403,'Application verification is required.');}},
  '@/lib/r2-storage':storage,'@/lib/r2-signing':{signR2Url},'@/lib/intake-server':{loadIntake:async()=>({})}
 });
 const result=await route.POST(new Request('https://kasa.test/api/r2/uploads',{method:'POST',
  body:JSON.stringify({fileName:'nrc.png',contentType:'image/png',byteSize:8,purpose:'cdf-document',submissionId:'submission01',kind:'nrc'})}));
 assert.equal(result.status,403);
 assert.deepEqual(created,[]);
});

test('upload initiation returns the signed condition and records protected completion metadata',async()=>{
 let created;
 const route=load('src/app/api/r2/uploads/route.ts',{
  '@/lib/firebase-admin':{db:{collection:()=>({doc:()=>({create:async value=>{created=value;}})})}},
  '@/lib/errors':errors,'@/lib/security':{sameOrigin:()=>{},rateLimit:async()=>{},requireAppCheck:async()=>{}},
  '@/lib/r2-storage':storage,'@/lib/r2-signing':{signR2Url},'@/lib/intake-server':{loadIntake:async()=>({})}
 });
 const response=await route.POST(new Request('https://kasa.test/api/r2/uploads',{method:'POST',
  body:JSON.stringify({fileName:'photo.png',contentType:'image/png',byteSize:8,purpose:'profile-photo'})}));
 assert.equal(response.status,201);
 const data=await response.json();
 assert.equal(created.writeOnce,true);
 assert.equal(data.headers['If-None-Match'],'*');
 assert.equal(signatureFor(data.uploadUrl,'PUT',data.headers),new URL(data.uploadUrl).searchParams.get('X-Amz-Signature'));
});

test('file listing filters pending uploads and sorts newest before limiting large accounts',async()=>{
 const records=Array.from({length:150},(_,i)=>({id:String(i).padStart(3,'0'),ownerUid:'owner',status:i<110?'pending':'ready',
  fileName:'file-'+i,createdAt:new Date(2026,0,1,0,i).toISOString()}));
 records.push({id:'other',ownerUid:'other',status:'ready',createdAt:'2099-01-01'});
 let selected=records;
 const query={where:(field,_op,value)=>{selected=selected.filter(r=>r[field]===value);return query;},
  orderBy:(field,direction)=>{selected.sort((a,b)=>direction==='desc'?b[field].localeCompare(a[field]):a[field].localeCompare(b[field]));return query;},
  limit:n=>{selected=selected.slice(0,n);return query;},get:async()=>({docs:selected.map(r=>({id:r.id,data:()=>r}))})};
 const route=load('src/app/api/r2/files/route.ts',{'@/lib/firebase-admin':{db:{collection:()=>query}},
  '@/lib/errors':errors,'@/lib/r2-storage':storage});
 const response=await route.GET(new Request('https://kasa.test/api/r2/files'));
 assert.equal(response.status,200);
 const {files}=await response.json();
 assert.equal(files.length,40);
 assert.equal(files[0].fileName,'file-149');
 assert.equal(files.at(-1).fileName,'file-110');
 const index=JSON.parse(read('firestore.indexes.json')).indexes.find(i=>i.collectionGroup==='r2Files');
 assert.deepEqual(index.fields.map(f=>f.fieldPath),['ownerUid','status','createdAt']);
 assert.equal(index.fields.at(-1).order,'DESCENDING');
});

test('refresh retains platform or personal selection and falls back only when unavailable',()=>{
 const {selectR2Destination}=load('src/lib/r2-storage-selection.ts');
 const both={platformAvailable:true,connections:[{id:'own',status:'active'},{id:'old',status:'disconnected'}]};
 assert.equal(selectR2Destination('platform',both),'platform');
 assert.equal(selectR2Destination('own',both),'own');
 assert.equal(selectR2Destination('old',both),'platform');
 assert.equal(selectR2Destination('platform',{...both,platformAvailable:false}),'own');
 assert.equal(selectR2Destination('own',{platformAvailable:false,connections:[]}),'');
 assert.match(read('src/components/R2StoragePanel.tsx'),/setSelected\(old=>selectR2Destination\(old,b\)\)/);
});

test('CDF client includes fresh attestation on both API calls and never sends it to R2',async t=>{
 const calls=[];
 let attestations=0;
 const {uploadToR2}=load('src/lib/r2-upload-client.ts',{'./firebase-client':{
  authHeaders:async()=>({Authorization:'Bearer example'}),appCheckToken:async()=>'attestation-'+(++attestations)
 }});
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  calls.push({url,headers:init.headers});
  return Response.json(calls.length===1?{fileId:id,uploadUrl:'https://r2.test/object',
   headers:{'Content-Type':'image/png','If-None-Match':'*'},completionEndpoint:'/api/r2/uploads/'+id+'/complete'}:{ok:true});
 });
 await uploadToR2(new File([png],'nrc.png',{type:'image/png'}),'cdf-document','platform',{submissionId:'submission01',kind:'nrc'});
 assert.equal(calls[0].headers['X-Firebase-AppCheck'],'attestation-1');
 assert.equal(calls[2].headers['X-Firebase-AppCheck'],'attestation-2');
 assert.deepEqual(calls[1].headers,{'Content-Type':'image/png','If-None-Match':'*'});
});
