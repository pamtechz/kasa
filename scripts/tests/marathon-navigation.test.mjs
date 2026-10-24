import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {marathonViewForPath,isMarathonWorkspacePath} from '../../src/lib/marathon-navigation.ts';

const worker=readFileSync(new URL('../../public/marthon-sw.js',import.meta.url),'utf8');
function fixture(cached={},network=async()=>{throw new TypeError('Offline');}){
 const handlers={},records=new Map(Object.entries(cached)),writes=[];
 const key=request=>typeof request==='string'?request:request.url;
 runInNewContext(worker,{
  URL,Response,self:{location:{origin:'https://school.test'},addEventListener:(name,handler)=>{handlers[name]=handler;}},
  caches:{open:async()=>({match:async request=>records.get(key(request)),put:async(request,response)=>{writes.push(key(request));records.set(key(request),response);}})},
  fetch:network
 });
 return {writes,async navigate(path,changes={}){
  const request={url:new URL(path,'https://school.test').href,method:'GET',mode:'navigate',...changes};
  let response;
  handlers.fetch({request,respondWith:value=>{response=value;}});
  return response?await response:null;
 }};
}
test('the requested path restores a cached root shell to its intended Marathon view',()=>{
 assert.equal(marathonViewForPath('/marthon/operations','overview'),'operations');
 assert.equal(marathonViewForPath('/marthon/categories','overview'),'categories');
 assert.equal(marathonViewForPath('/marathon/operations/','overview'),'operations');
 assert.equal(marathonViewForPath('/marthon','operations'),'overview');
 assert.equal(marathonViewForPath('/marthon/unknown','operations'),'overview');
});
test('offline category navigation reuses a cached operations shell without redirecting the requested filter',async()=>{
 const url=new URL('https://school.test/marthon/operations?category=safety');
 const app=fixture({'https://school.test/marthon/operations':new Response('operations shell')});
 const response=await app.navigate(url.href);
 assert.equal(await response.text(),'operations shell');
 assert.equal(response.status,200);
 assert.equal(url.searchParams.get('category'),'safety');
 assert.equal(marathonViewForPath(url.pathname,'overview'),'operations');
 assert.equal(app.writes.length,0);
});
test('offline category navigation also falls back to the root shell and restores the operations view',async()=>{
 const app=fixture({'/marthon':new Response('root shell')});
 const response=await app.navigate('/marthon/operations?category=finance');
 assert.equal(await response.text(),'root shell');
 assert.equal(marathonViewForPath('/marthon/operations','overview'),'operations');
});
test('online category navigation caches a shared query-free shell for another offline category',async()=>{
 let online=true;
 const app=fixture({},async request=>{assert.match(request.url,/category=/);if(!online)throw new TypeError('Offline');return new Response('shared operations shell',{headers:{'content-type':'text/html'}});});
 assert.equal((await app.navigate('/marthon/operations?category=safety')).status,200);
 assert.deepEqual(app.writes,['https://school.test/marthon/operations']);
 online=false;
 assert.equal(await(await app.navigate('/marthon/operations?category=planning')).text(),'shared operations shell');
});
test('API calls, unrelated query parameters and non-navigation requests are not added to the shell cache',async()=>{
 const app=fixture();
 for(const path of ['/api/marathon/tasks?category=safety','/marthon/operations?token=private','/marthon/operations?category=safety&token=private','/marthon/operations?_rsc=example','/marthon/operations?category=','/marthon-unrelated?category=safety','https://other.test/marthon/operations?category=safety']){
  assert.equal(await app.navigate(path),null,path);
 }
 assert.equal(await app.navigate('/marthon/operations?category=safety',{method:'POST'}),null);
 assert.equal(await app.navigate('/marthon/operations?category=safety',{mode:'cors'}),null);
 assert.deepEqual(app.writes,[]);
});

test('local navigation only intercepts canonical workspace views and retains category destinations',()=>{
 for(const href of ['/marthon','/marthon/','/marthon/operations','/marthon/categories','/marthon/operations?category=safety','/marthon/timeline#race-day']){
  assert.equal(isMarathonWorkspacePath(href),true,href);
 }
 for(const href of ['/marthon/login','/marthon/bootstrap','/dashboard','/marthon/operations/nested','//other.test/marthon','https://other.test/marthon','javascript:alert(1)','/marthon-elsewhere','/marthon/unknown']){
  assert.equal(isMarathonWorkspacePath(href),false,href);
 }
});
