import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
function compile(path,stubs){
 const exports={};
 const js=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',js)(name=>Object.hasOwn(stubs,name)?stubs[name]:require(name),exports);
 return exports;
}
test('storage status is admin-gated and never serializes a credential value',async()=>{
 const path='src/app/api/admin/settings/storage-status/route.ts',src=read(path);
 assert.match(src,/operator\(req,\['super_admin','admin'\]\)/);
 assert.doesNotMatch(src,/secretAccessKey:/);
 assert.doesNotMatch(src,/accessKeyId:/);
 const operator=async()=>{};
 const route=compile(path,{
  '@/lib/security':{operator},
  '@/lib/errors':{fail:e=>Response.json({error:e.message},{status:403}),json:(v,s)=>Response.json(v,{status:s})},
  '@/lib/r2-storage':{platformR2:()=>null},
  '@/lib/r2-crypto':{r2EncryptionReady:()=>true},
  '@/lib/r2-signing':{signR2Url:()=>'',validateR2Address:()=>{}}
 });
 const old={};
 const keys=['R2_PLATFORM_ACCOUNT_ID','R2_PLATFORM_BUCKET','R2_PLATFORM_ACCESS_KEY_ID','R2_PLATFORM_SECRET_ACCESS_KEY'];
 for(const k of keys){old[k]=process.env[k];delete process.env[k];}
 try{
  const result=await route.GET(new Request('https://kasa.test/api/admin/settings/storage-status'));
  assert.equal(result.status,200);
  const data=await result.json();
  assert.equal(data.platformConfigured,false);
  assert.deepEqual(data.missingVariables,keys);
  assert.equal(data.byobEncryptionConfigured,true);
  assert.equal(data.connectivity,'not_configured');
  assert.equal(JSON.stringify(data).includes('secretAccessKey'),false);
 }finally{
  for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
 }
});
test('storage readiness remains privileged, never a public R2 configuration endpoint',()=>{
 const panel=read('src/components/R2StoragePanel.tsx');
 const roles=read('src/lib/permissions.ts');
 const profile=read('src/app/(portal)/dashboard/profile/page.tsx');
 assert.doesNotMatch(panel,/institutional bucket status|R2_PLATFORM_/i);
 assert.match(panel,/ExternalStorageConnection/);
 assert.match(profile,/administrator=\{profile\?\.role==='super_admin'/);
 assert.match(roles,/\/api\/admin\/settings\/storage-status/);
});
