import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {marathonViewForPath,isMarathonWorkspacePath} from '../../src/lib/marathon-navigation.ts';

const worker=readFileSync(new URL('../../public/marathon-sw.js',import.meta.url),'utf8');
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
 assert.equal(marathonViewForPath('/marathon/operations','overview'),'operations');
 assert.equal(marathonViewForPath('/marathon/categories','overview'),'categories');
 assert.equal(marathonViewForPath('/marathon/operations/','overview'),'operations');
 assert.equal(marathonViewForPath('/marathon','operations'),'overview');
 assert.equal(marathonViewForPath('/marathon/unknown','operations'),'overview');
});
test('offline category navigation reuses a cached operations shell without redirecting the requested filter',async()=>{
 const url=new URL('https://school.test/marathon/operations?category=safety');
 const app=fixture({'https://school.test/marathon/operations':new Response('operations shell')});
 const response=await app.navigate(url.href);
 assert.equal(await response.text(),'operations shell');
 assert.equal(response.status,200);
 assert.equal(url.searchParams.get('category'),'safety');
 assert.equal(marathonViewForPath(url.pathname,'overview'),'operations');
 assert.equal(app.writes.length,0);
});
test('offline category navigation also falls back to the root shell and restores the operations view',async()=>{
 const app=fixture({'/marathon':new Response('root shell')});
 const response=await app.navigate('/marathon/operations?category=finance');
 assert.equal(await response.text(),'root shell');
 assert.equal(marathonViewForPath('/marathon/operations','overview'),'operations');
});
test('online category navigation caches a shared query-free shell for another offline category',async()=>{
 let online=true;
 const app=fixture({},async request=>{assert.match(request.url,/category=/);if(!online)throw new TypeError('Offline');return new Response('shared operations shell',{headers:{'content-type':'text/html'}});});
 assert.equal((await app.navigate('/marathon/operations?category=safety')).status,200);
 assert.deepEqual(app.writes,['https://school.test/marathon/operations']);
 online=false;
 assert.equal(await(await app.navigate('/marathon/operations?category=planning')).text(),'shared operations shell');
});
test('API calls, unrelated query parameters and non-navigation requests are not added to the shell cache',async()=>{
 const app=fixture();
 for(const path of ['/api/marathon/tasks?category=safety','/marathon/operations?token=private','/marathon/operations?category=safety&token=private','/marathon/operations?_rsc=example','/marathon/operations?category=','/marathon-unrelated?category=safety','https://other.test/marathon/operations?category=safety']){
  assert.equal(await app.navigate(path),null,path);
 }
 assert.equal(await app.navigate('/marathon/operations?category=safety',{method:'POST'}),null);
 assert.equal(await app.navigate('/marathon/operations?category=safety',{mode:'cors'}),null);
 assert.deepEqual(app.writes,[]);
});

test('local navigation only intercepts canonical workspace views and retains category destinations',()=>{
 for(const href of ['/marathon','/marathon/','/marathon/operations','/marathon/categories','/marathon/operations?category=safety','/marathon/timeline#race-day']){
  assert.equal(isMarathonWorkspacePath(href),true,href);
 }
 for(const href of ['/marathon/login','/marathon/bootstrap','/dashboard','/marathon/operations/nested','//other.test/marathon','https://other.test/marathon','javascript:alert(1)','/marathon-elsewhere','/marathon/unknown']){
  assert.equal(isMarathonWorkspacePath(href),false,href);
 }
});
