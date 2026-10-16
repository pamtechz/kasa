import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,existsSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {parseDevOptions} from '../dev-options.mjs';

test('Windows npm strips the flag but the positional 3001 still selects port 3001',()=>{
 assert.deepEqual(parseDevOptions(['3001'],{}),{
  port:3001,distDir:'.next-dev-3001',passthrough:[]
 });
 assert.deepEqual(parseDevOptions(['--port','3001'],{}),parseDevOptions(['3001'],{}));
 assert.deepEqual(parseDevOptions(['--port=3001'],{}),parseDevOptions(['3001'],{}));
});

test('confirmed cleanup removes generated caches but not application files',()=>{
 const root=mkdtempSync(resolve(tmpdir(),'kasa-clean-test-'));
 const cleanup=resolve(dirname(fileURLToPath(import.meta.url)),'../clean-next-cache.mjs');
 try{
  writeFileSync(resolve(root,'package.json'),JSON.stringify({name:'kasa-enrollment-network'}));
  for(const folder of ['.next','.next-dev-3000','important-data'])mkdirSync(resolve(root,folder));
  const preview=spawnSync(process.execPath,[cleanup],{cwd:root,encoding:'utf8'});
  assert.equal(preview.status,0,preview.stderr);
  assert.equal(existsSync(resolve(root,'.next')),true,'Dry run must preserve generated files');
  const result=spawnSync(process.execPath,[cleanup,'--yes'],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(existsSync(resolve(root,'.next')),false);
  assert.equal(existsSync(resolve(root,'.next-dev-3000')),false);
  assert.equal(existsSync(resolve(root,'important-data')),true);
 }finally{
  rmSync(root,{recursive:true,force:true});
 }
});
