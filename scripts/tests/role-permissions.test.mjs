
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative,sep} from 'node:path';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

function load(){
 const code=readFileSync('src/lib/access-policy.ts','utf8');
 const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exp={};
 runInNewContext(js,{exports:exp});
 return exp;
}
const policy=load();
const roles=['super_admin','admin','reviewer','finance','agent','student'];
const permitted=(role,cap)=>policy.hasCapability(role,cap);
test('Role matrix enforces least privilege across six real roles',()=>{
 assert.deepEqual(roles.map(x=>[x,permitted(x,'staff.manage')]),[
 ['super_admin',true],['admin',false],['reviewer',false],
 ['finance',false],['agent',false],['student',false]
 ]);
 assert.equal(permitted('finance','finance.record'),true);
 assert.equal(permitted('finance','applications.review'),false);
 assert.equal(permitted('reviewer','applications.review'),true);
 assert.equal(permitted('reviewer','finance.record'),false);
 assert.equal(permitted('agent','applications.create'),true);
 assert.equal(permitted('agent','staff.manage'),false);
 assert.equal(permitted('student','applications.create'),false);
 assert.equal(permitted('student','notifications.read'),true);
});
test('Every privileged API file and verb is explicitly mapped (no accidental new endpoints)',()=>{
 const targets=['src/app/api/admin','src/app/api/agent'];
 function walk(dir){
  return readdirSync(dir,{withFileTypes:true}).flatMap(d=>{
   const path=join(dir,d.name);
   return d.isDirectory()?walk(path):d.name==='route.ts'?[path]:[];
  });
 }
 const routes=targets.flatMap(walk).concat('src/app/api/notifications/route.ts');
 for(const file of routes){
  const path='/'+relative('src/app',file).split(sep).join('/').replace(/\/route\.ts$/,'')
    .replace(/\[([^\]]+)\]/g,':$1');
  const operations=[...readFileSync(file,'utf8').matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)/g)].map(x=>x[1]);
  assert.ok(operations.length>0,file+' must declare HTTP methods');
  for(const method of operations){
   assert.ok(policy.requiredApiCapability(path,method),file+' '+method+' is absent from the server deny list');
  }
 }
});
test('Unknown endpoints, unsupported methods and ungranted actions fail closed',()=>{
 assert.equal(policy.requiredApiCapability('/api/admin/unmapped','GET'),undefined);
 assert.equal(policy.requiredApiCapability('/api/admin/users','DELETE'),undefined);
 assert.equal(policy.requiredApiCapability('/api/admin/forms/import','POST'),'forms.manage');
 assert.equal(policy.requiredApiCapability('/api/admin/forms/import','GET'),undefined);
 assert.equal(policy.requiredApiCapability('/api/admin/forms/example','GET'),'forms.read');
 assert.equal(policy.isControlledApi('/api/admin/finance'),true);
 assert.equal(permitted('student',policy.requiredApiCapability('/api/admin/finance','GET')),false);
 assert.equal(permitted('finance',policy.requiredApiCapability('/api/admin/finance','POST')),true);
});
test('Navigation denies privileged pages and uses the same permission matrix',()=>{
 assert.equal(policy.canAccessPage('reviewer','/dashboard/forms'),false);
 assert.equal(policy.canAccessPage('reviewer','/dashboard/settings'),false);
 assert.equal(policy.canAccessPage('agent','/dashboard/applications/new'),true);
 assert.equal(policy.canAccessPage('agent','/dashboard/staff'),false);
 assert.equal(policy.canAccessPage('student','/dashboard/finance'),false);
 assert.equal(policy.canAccessPage('finance','/dashboard/finance'),true);
 assert.equal(policy.canAccessPage('finance','/dashboard/applications'),false);
});
test('Admin API enforces the permission matrix after identity verification',()=>{
 const src=readFileSync('src/lib/security.ts','utf8');
 assert.match(src,/isControlledApi\(path\)/);
 assert.match(src,/requiredApiCapability\(path,req\.method\)/);
 assert.match(src,/!hasCapability\(p\.role,cap\)/);
});

test('Provisioning cannot manufacture privileged profiles or bypass email verification',()=>{
 const agent=readFileSync('src/app/api/admin/agents/route.ts','utf8');
 const profile=readFileSync('src/app/api/profile/route.ts','utf8');
 assert.match(agent,/user\.emailVerified/);
 assert.match(agent,/auth\/user-not-found/);
 assert.doesNotMatch(agent,/user \? user\.uid : newId\(\)/);
 assert.match(profile,/existing\.data\(\)\?\.active!==true/);
 assert.match(profile,/user\.email_verified!==true/);
 assert.match(profile,/sameOrigin\(req\)/);
 assert.match(profile,/Account security flags/);
});

test('Private profile reads require verified identity and deny suspended accounts',()=>{
 const src=readFileSync('src/app/api/profile/route.ts','utf8');
 assert.match(src,/token\.email_verified!==true/);
 assert.match(src,/profileData\.active!==true/);
});
