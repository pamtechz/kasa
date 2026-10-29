// Cross-platform local checks. Requires Node 22 and npm ci before running.
// --quick runs focused date behavior tests without linting or building.
import {spawnSync} from 'node:child_process';

const major=Number(process.versions.node.split('.')[0]);
if(major!==22){
 console.error('KASA tests require Node 22. Current version: '+process.version);
 process.exit(1);
}
const quick=process.argv.includes('--quick');
const steps=quick
 ?[['node',['--experimental-strip-types','--test','scripts/tests/marathon-date-filters.test.mjs']]]
 :[['npm',['run','test:source']],['npm',['run','lint']],['npm',['run','typecheck']],['npm',['run','build']]];
for(const [cmd,args] of steps){
 console.log('\n=== '+[cmd,...args].join(' ')+' ===');
 const onWindows=process.platform==='win32';
 const result=spawnSync(onWindows&&cmd==='npm'?'npm.cmd':cmd,args,{stdio:'inherit',shell:onWindows&&cmd==='npm'});
 if(result.error){console.error(result.error.message);process.exit(1);}
 if(result.status!==0)process.exit(result.status||1);
}
console.log('\nMarathon local checks passed. Browser sign-in, sync and permissions still require manual verification.');
