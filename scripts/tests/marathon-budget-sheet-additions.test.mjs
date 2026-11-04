import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const source=JSON.parse(read('src/data/marathon-budget-sheet-additions-20261104.json'));
test('new spreadsheet rows preserve quantities, approved status and owner-entered verified payments',()=>{
 assert.equal(source.rows.length,2);assert.equal(source.sourceRange,'Budget!A92:S93');
 assert.equal(source.rows.reduce((n,r)=>n+r.plannedMinor,0),2400000);
 assert.equal(source.rows.reduce((n,r)=>n+r.actualPaidMinor,0),1000000);
 assert.equal(source.rows[0].description,'Web Development');assert.equal(source.rows[1].unitCostMinor,400000);
 for(const row of source.rows){assert.equal(row.quantity*row.unitCostMinor*row.months,row.plannedMinor);assert.ok(row.actualPaidMinor<=row.plannedMinor);assert.equal(row.status,'approved');}
});
test('append migration is scoped, transactional, deduplicated and never overwrites old budget rows',()=>{
 const s=read('scripts/apply-marathon-budget-sheet-additions.mjs');
 assert.match(s,/account\?\.project_id!==source.firebaseProjectId/);assert.match(s,/db\.runTransaction/);
 assert.match(s,/alreadyApplied:true/);assert.match(s,/seen.has\(identity\(r\)\)/);
 assert.match(s,/tx.create\(eventRef.collection\('budgetLines'\).doc\(id\)/);
 assert.doesNotMatch(s,/\.delete\(/);assert.doesNotMatch(s,/tx\.(?:set|update)\(.*budgetLines/);
 assert.match(s,/No School finance receipt was created/);assert.match(s,/source\.originalSourceSha256/);
});
test('notice reads preserve membership and budget access, dismissals use only the acting user',()=>{
 const s=read('src/app/api/marathon/events/[id]/notices/route.ts');
 assert.match(s,/marathonIdentity\(req\)/);assert.match(s,/requireBudgetAccess\(identity,event,'read'\)/);
 assert.match(s,/recipientUids.includes\(identity.uid\)/);assert.match(s,/FieldValue.arrayUnion\(identity.uid\)/);
 assert.match(s,/sameOrigin\(req\)/);assert.doesNotMatch(s,/return json\(\{.*recipientUids/);
 const migration=read('scripts/apply-marathon-budget-sheet-additions.mjs');
 assert.match(migration,/pushStatus!=='pending'/);assert.match(migration,/allowed.has\(d.uid\)/);
 assert.match(migration,/notification:\{title:'Draft budget available'/);
});
