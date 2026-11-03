import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=(path)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
test('rules REST deployment script parses correctly before it can be run by CI',()=>{
 const check=spawnSync(process.execPath,['--check','scripts/deploy-firestore-rules-rest.mjs'],{encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
});
test('rules deployment pins production project, default database and exact checked-in rules',()=>{
 const script=read('scripts/deploy-firestore-rules-rest.mjs');
 const action=read('.github/workflows/deploy-firestore-rules.yml');
 assert.match(script,/const PROJECT='kasa-recruite'/);
 assert.match(script,/releases\/cloud\.firestore/);
 assert.match(script,/readFileSync\('firestore.rules','utf8'\)/);
 assert.match(script,/source:\{files:\[\{name:'firestore.rules',content:source\}\]\}/);
 assert.match(script,/digest\(sourceOf\(published\)\)!==digest\(source\)/);
 assert.match(action,/node scripts\/deploy-firestore-rules-rest\.mjs/);
 assert.doesNotMatch(action,/firebase-tools@15\.34\.0 deploy/);
 assert.match(action,/KASA_FIREBASE_SERVICE_ACCOUNT_JSON/);
});
test('rules deployment fails closed with missing credentials and unknown project',()=>{
 const script=read('scripts/deploy-firestore-rules-rest.mjs');
 assert.match(script,/if\(!CREDENTIALS\)fail/);
 assert.match(script,/key.project_id!==PROJECT/);
 assert.match(script,/firestore\.rules fail mandatory private-data safeguards/);
 assert.match(script,/if\(current\?\.rulesetName\)/);
 assert.match(script,/verified.rulesetName!==created.name/);
});
