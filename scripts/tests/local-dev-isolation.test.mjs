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
 // Observed on Windows: npm run dev -- --port 3001 -> node scripts/dev.mjs 3001
 assert.deepEqual(parseDevOptions(['3001'],{}),{port:3001,distDir:'.next-dev-3001',passthrough:[]});
 assert.equal(parseDevOptions(['--port','3001'],{}).port,3001);
 assert.equal(parseDevOptions([], {KASA_DEV_PORT:'3030'}).port,3030);
});

test('rejects unsafe or ambiguous port inputs',()=>{
 for(const args of [['--port','0'],['--port','65536'],['--port','abc'],['--port','../../tmp'],['--port','3000','--port','3001'],['--port'],['22'],['70000']]){
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
 assert.match(runner,/availablePort\(port,host\)/);
 assert.match(runner,/EADDRINUSE/);
 assert.match(runner,/KASA_NEXT_LOCAL_DEV_PORT:String\(port\)/);
});

test('cache files remain untracked and Vercel auto deployment is disabled',()=>{
 const gitignore=source('.gitignore');
 assert.match(gitignore,/\.next/);
 const vercel=JSON.parse(source('vercel.json'));
 assert.equal(vercel.git.deploymentEnabled,false);
});

test('port availability probe and Next bind the same network interface',()=>{
 const runner=source('scripts/dev.mjs');
 assert.match(runner,/server\.listen\(\{port,host,exclusive:true\}/);
 assert.match(runner,/availablePort\(port,host\)/);
 assert.match(runner,/hasExplicitHost/);
 assert.match(runner,/--hostname',host/);
 assert.match(runner,/const host=requestedHost\(passthrough\)/);
});

test('cache recovery is restricted to explicit generated Next.js folders',()=>{
 const cleaner=source('scripts/clean-next-cache.mjs');
 assert.match(cleaner,/process\.argv\.includes\('--yes'\)/);
 assert.match(cleaner,/pkg\.name!=='kasa-enrollment-network'/);
 assert.match(cleaner,/name==='\.next'/);
 assert.match(cleaner,/\.next-dev-/);
 assert.match(cleaner,/info\.isDirectory\(\)&&!info\.isSymbolicLink\(\)/);
 assert.match(cleaner,/const candidates=entries\.filter\(/);
 const pkg=JSON.parse(source('package.json'));
 assert.equal(pkg.scripts['clean:next'],'node scripts/clean-next-cache.mjs');
 assert.equal(pkg.scripts['clean:next:confirm'],'node scripts/clean-next-cache.mjs --yes');
 assert.equal(pkg.scripts['dev:3001'],'node scripts/dev.mjs 3001');
});

test('doctor reports tracked local changes and Git divergence without file content',()=>{
 const doctor=source('scripts/doctor.mjs');
 assert.match(doctor,/git',\['status','--short','--untracked-files=no'\]/);
 assert.match(doctor,/git',\['rev-list','--left-right','--count'/);
 assert.doesNotMatch(doctor,/git',\['diff'/);
});
