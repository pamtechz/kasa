#!/usr/bin/env node
import {readdirSync,rmSync,statSync,existsSync} from 'node:fs';
import {resolve,basename} from 'node:path';

const root=process.cwd();
const pkg=JSON.parse((await import('node:fs')).readFileSync(resolve(root,'package.json'),'utf8'));
if(pkg.name!=='kasa-enrollment-network'){
 console.error('[KASA] Refusing to clean: current folder is not the KASA app.');
 process.exitCode=1;
}else{
 const entries=readdirSync(root);
 const candidates=entries.filter(name=>name==='.next'||/^\.next-dev-[0-9]{4,5}$/.test(name))
  .filter(name=>{
   const target=resolve(root,name);
   return basename(target)===name&&statSync(target).isDirectory();
  });
 if(!process.argv.includes('--yes')){
  console.log('[KASA] Generated Next.js folders:',candidates.length?candidates.join(', '):'(none)');
  console.log('[KASA] Stop ALL KASA Next.js dev/build/start processes before cleaning.');
  console.log('[KASA] To remove only these generated folders: npm run clean:next -- --yes');
 }else{
  console.log('[KASA] Cleaning only generated .next and .next-dev-<port> folders.');
  for(const name of candidates){
   const path=resolve(root,name);
   rmSync(path,{recursive:true,force:true,maxRetries:5,retryDelay:250});
   console.log('[KASA] Removed',name);
  }
  console.log('[KASA] Source, Firebase settings, .env.local and node_modules were not touched.');
 }
}
