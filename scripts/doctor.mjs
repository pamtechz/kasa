#!/usr/bin/env node
import {existsSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const major=Number(process.versions.node.split('.')[0]);
const nodeOk=major===22;
console.log(`KASA Node.js: ${process.versions.node}`);
console.log(nodeOk?'Node.js matches the repository Node 22 requirement.':'Warning: repository expects Node.js 22.x. Use Node 22 for CI parity.');
const git=spawnSync('git',['branch','--show-current'],{encoding:'utf8',windowsHide:true});
if(git.status===0)console.log(`Current Git branch: ${git.stdout.trim()||'(detached)'}`);
else console.log('Git status could not be determined.');
const lock=existsSync('package-lock.json');
console.log(lock?'Local npm lockfile: present.':'Local npm lockfile: absent; npm install may resolve different dependency versions over time.');
console.log('Production build directory: .next/');
const development=readdirSync('.', {withFileTypes:true})
 .filter(entry=>entry.isDirectory()&&entry.name.startsWith('.next-dev-'))
 .map(entry=>entry.name);
console.log('Isolated development output:',development.length?development.join(', '):'none yet');
console.log('Recommended commands: npm run test:source; npm run typecheck; npm run build; npm run dev');
console.log('For Git divergence or a missing routes-manifest.json, see docs/LOCAL_DEVELOPMENT_RECOVERY.md');
console.log('Vercel deployment is NOT part of this diagnostic.');
