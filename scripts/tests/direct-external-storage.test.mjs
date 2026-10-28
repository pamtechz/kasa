import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
function compile(path,stubs={}){
 const exports={};const js=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',js)(id=>id==='server-only'?{}:Object.hasOwn(stubs,id)?stubs[id]:require(id),exports);return exports;
}
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const errors={HttpError,json:(data,status=200)=>Response.json(data,{status}),fail:e=>Response.json({error:e.message},{status:e.status||500})};
const target={accountId:'a'.repeat(32),bucket:'my-own-bucket',jurisdiction:'default'};
function credentialsFixture({revokeDuringCreation=false,permission=true}={}){
 const records=new Map([['r2OAuthSessions/owner',{status:'connected',connectedAt:'generation-1'}],['r2Connections/own',{status:'active'}]]);
 const ref=path=>({path,get:async()=>({data:()=>records.get(path)})});
 const db={collection:name=>({doc:id=>ref(name+'/'+id)}),runTransaction:async cb=>cb({get:async r=>({data:()=>records.get(r.path)}),set:(r,value)=>records.set(r.path,value)})};
 const control=[];
 const cloudflareApi=async(_uid,path)=>{
  control.push(path);
  return Response.json({success:true,result:path.endsWith('permission_groups')?(permission?[{id:'b'.repeat(32),name:'Workers R2 Storage Bucket Item Write'}]:[]):{name:target.bucket}});
 };
 const module=compile('src/lib/r2-oauth-direct.ts',{'./firebase-admin':{db},'./errors':errors,
  './r2-oauth':{cloudflareApi,cloudflareBearer:async()=>'private-oauth-token',CLOUD_API:'https://api.cloudflare.com/client/v4'},
  './r2-crypto':{encryptR2Secrets:(context,value)=>JSON.stringify({context,value}),decryptR2Secrets:(_context,value)=>JSON.parse(value).value},
  './r2-signing':{validateR2Address:()=>{}}});
 return {records,module,control,revokeDuringCreation};
}
test('OAuth provisioning creates only short-lived bucket-scoped S3 credentials and validates provider access on cache hits',async t=>{
 const fixture=credentialsFixture(),requests=[];
 t.mock.method(globalThis,'fetch',async(url,init)=>{requests.push({url,init});return Response.json({success:true,result:{id:'c'.repeat(32),value:'d'.repeat(40)}});});
 const c=await fixture.module.oauthR2Credentials('owner','own',target);
 assert.equal(c.accessKeyId,'c'.repeat(32));assert.equal(c.secretAccessKey,createHash('sha256').update('d'.repeat(40)).digest('hex'));
 assert.equal(requests.length,1);
 const policy=JSON.parse(requests[0].init.body);
 assert.deepEqual(policy.policies[0].resources,{['com.cloudflare.edge.r2.bucket.'+target.accountId+'_default_'+target.bucket]:'*'});
 assert.deepEqual(policy.policies[0].permission_groups,[{id:'b'.repeat(32)}]);
 assert.ok(Date.parse(policy.expires_on)>Date.now()+3500000&&Date.parse(policy.expires_on)<=Date.now()+3600000);
 const stored=fixture.records.get('r2ConnectionSecrets/own');
 assert.ok(stored.encrypted);assert.equal(stored.authorizedAt,'generation-1');assert.equal(stored.accessKeyId,undefined);
 await fixture.module.oauthR2Credentials('owner','own',target);
 assert.equal(requests.length,1);assert.equal(fixture.control.filter(p=>p.endsWith('/r2/buckets/my-own-bucket')).length,2);
});
test('disconnected authorization cannot mint or reuse S3 credentials',async()=>{
 const fixture=credentialsFixture();fixture.records.set('r2OAuthSessions/owner',{status:'disconnected'});
 await assert.rejects(fixture.module.oauthR2Credentials('owner','own',target),/Authorize your Cloudflare/);
 assert.equal(fixture.control.length,0);assert.equal(fixture.records.has('r2ConnectionSecrets/own'),false);
});
test('revocation during token creation prevents persistence and attempts provider cleanup',async t=>{
 const fixture=credentialsFixture(),methods=[];
 t.mock.method(globalThis,'fetch',async(_url,init)=>{
  methods.push(init.method);
  if(init.method==='POST'){fixture.records.set('r2OAuthSessions/owner',{status:'disconnected'});return Response.json({success:true,result:{id:'c'.repeat(32),value:'d'.repeat(40)}});}
  return Response.json({success:true});
 });
 await assert.rejects(fixture.module.oauthR2Credentials('owner','own',target),/disconnected during setup/);
 assert.equal(fixture.records.has('r2ConnectionSecrets/own'),false);assert.deepEqual(methods,['POST','DELETE']);
});
test('missing token provisioning permission fails before creating credentials',async()=>{
 const fixture=credentialsFixture({permission:false});
 await assert.rejects(fixture.module.oauthR2Credentials('owner','own',target),/did not grant permission/);
 assert.equal(fixture.records.has('r2ConnectionSecrets/own'),false);
});
test('guest session identifiers reveal no cookie secret and expired sessions are rejected',async()=>{
 let record={expiresAt:Date.now()+60000};const lib=compile('src/lib/r2-guest.ts',{'./firebase-admin':{db:{collection:()=>({doc:()=>({get:async()=>({data:()=>record})})})}}});
 const secret='a'.repeat(43),id=lib.guestStorageId(secret);
 assert.match(id,/^guest_[a-f0-9]{64}$/);assert.equal(id.includes(secret),false);
 const request=new Request('https://kasa.test/',{headers:{Cookie:'__Host-kasa-storage='+secret}});
 assert.equal(await lib.guestStorageIdentity(request),id);
 record={expiresAt:Date.now()-1};assert.equal(await lib.guestStorageIdentity(request),null);
 assert.equal(await lib.guestStorageIdentity(new Request('https://kasa.test/')),null);
});
test('all web file upload surfaces use direct external transfer, never multipart requests to KASA',()=>{
 function scan(dir){for(const item of readdirSync(new URL('../../'+dir,import.meta.url),{withFileTypes:true})){
  const path=dir+'/'+item.name;if(item.isDirectory())scan(path);else if(/\.tsx?$/.test(item.name))assert.doesNotMatch(read(path),/new FormData\(|\.formData\(/,path);
 }}scan('src');
 const middleware=read('src/middleware.ts');assert.match(middleware,/multipart/);assert.match(middleware,/status:415/);
});
test('new upload initiation rejects shared KASA bucket and foreign connections',async()=>{
 let resolved=0,created=0;
 const query={where:()=>query,limit:()=>query,get:async()=>({docs:[{id:'own',data:()=>({status:'active'})}]})};
 const db={collection:name=>name==='r2Connections'?query:{doc:()=>({get:async()=>({data:()=>({connectionId:'own'})}),create:async()=>created++})}};
 const route=compile('src/app/api/r2/uploads/route.ts',{'@/lib/firebase-admin':{db},'@/lib/errors':errors,'@/lib/security':{sameOrigin:()=>{},rateLimit:async()=>{}},
  '@/lib/r2-storage':{storageIdentity:async()=>({uid:'owner',profile:{role:'student'}}),resolveR2:async()=>{resolved++;return target;}},
  '@/lib/r2-signing':{signR2Url:()=>assert.fail('must not sign rejected connection')},'@/lib/intake-server':{}});
 for(const connectionId of ['platform','foreign']){
  const response=await route.POST(new Request('https://kasa.test/api/r2/uploads',{method:'POST',body:JSON.stringify({fileName:'photo.png',contentType:'image/png',byteSize:8,purpose:'profile-photo',connectionId})}));
  assert.equal(response.status,409);
 }
 assert.equal(resolved,0);assert.equal(created,0);
});
test('anonymous applicant cannot upload private profile, official PDF or CDF evidence using guest permissions',async()=>{
 const route=compile('src/app/api/r2/uploads/route.ts',{'@/lib/firebase-admin':{db:{}},'@/lib/errors':errors,'@/lib/security':{sameOrigin:()=>{},rateLimit:async()=>{}},
  '@/lib/r2-storage':{storageIdentity:async()=>({uid:'guest_abc',guest:true,profile:{role:'student'}})},'@/lib/r2-signing':{},'@/lib/intake-server':{}});
 for(const purpose of ['profile-photo','acceptance-pdf','cdf-document','personal-document']){
  const response=await route.POST(new Request('https://kasa.test/api/r2/uploads',{method:'POST',body:JSON.stringify({fileName:'photo.png',contentType:'image/png',byteSize:8,purpose})}));
  assert.equal(response.status,403);
 }
});
