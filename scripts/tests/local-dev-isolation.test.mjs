import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDevOptions} from '../dev-options.mjs';

const source=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('default development port uses independent generated files',()=>{
 const o=parseDevOptions([],{});
 assert.equal(o.port,3000);
 assert.equal(o.distDir,'.next-dev-3000');
 assert.deepEqual(o.passthrough,[]);
});

test('explicit ports receive a different cache',()=>{
 const o=parseDevOptions(['--port','3001','--hostname','127.0.0.1'],{});
 assert.deepEqual(o,{port:3001,distDir:'.next-dev-3001',passthrough:['--hostname','127.0.0.1']});
 assert.equal(parseDevOptions(['-p','4210'],{}).distDir,'.next-dev-4210');
 assert.equal(parseDevOptions(['--port=5500'],{}).distDir,'.next-dev-5500');
});

test('rejects unsafe or ambiguous port inputs',()=>{
 for(const args of [['--port','0'],['--port','65536'],['--port','abc'],['--port','../../tmp'],['--port','3000','--port','3001'],['--port']]){
  assert.throws(()=>parseDevOptions(args,{}));
 }
});

test('production and development do not share Next.js manifest output',()=>{
 const config=source('next.config.ts');
 const runner=source('scripts/dev.mjs');
 const pkg=JSON.parse(source('package.json'));
 assert.equal(pkg.scripts.dev,'node scripts/dev.mjs');
 assert.match(config,/distDir: isolatedDevelopmentDir/);
 assert.match(config,/KASA_NEXT_LOCAL_DEV === '1'/);
 assert.match(config,/\.next-dev-/);
 assert.match(config,/\: '\.next'/);
 assert.match(runner,/availablePort\(port\)/);
 assert.match(runner,/EADDRINUSE/);
 assert.match(runner,/KASA_NEXT_LOCAL_DEV_PORT:String\(port\)/);
});

test('cache files remain untracked and Vercel auto deployment is disabled',()=>{
 const gitignore=source('.gitignore');
 assert.match(gitignore,/\.next/);
 const vercel=JSON.parse(source('vercel.json'));
 assert.equal(vercel.git.deploymentEnabled,false);
});
