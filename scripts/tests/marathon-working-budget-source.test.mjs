import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const draft=JSON.parse(read('src/data/marathon-2027-working-budget.json'));
const kwacha=value=>/^(?:K)?[\d,]+$/.test(value)?Number(value.replace('K','').replaceAll(',','')):null;
test('source draft has exactly 89 actual item rows and 5,000 runners at K450',()=>{
 assert.equal(draft.eventId,'kasa-life-2027-march');
 assert.equal(draft.targetRunners,5000);
 assert.equal(draft.registrationFeeMinor,45000);
 assert.equal(draft.projectedRegistrationMinor,225000000);
 assert.equal(draft.cashSponsorshipTargetMinor,150000000);
 assert.equal(draft.rows.length,89);
 assert.equal(draft.sourceDocumentSha256,'e176cd00bfb29c5c0bf0f48d673a51d34873984226d8f58abb45e29459fef4ce');
});
test('all costed categories total exactly K1,519,750 with no double-counting',()=>{
 const costed=draft.rows.filter(x=>x.classification==='costed');
 assert.equal(costed.length,26);
 const minor=costed.reduce((sum,x)=>sum+kwacha(x.totalCostLabel)*100,0);
 assert.equal(minor,151975000);
 assert.equal(draft.plannedCostedMinor,minor);
 for(const section of [7,8,9]){
  const allocation=draft.rows.filter(x=>x.section===section&&x.classification==='costed');
  assert.equal(allocation.length,1);
  assert.equal(kwacha(allocation[0].totalCostLabel),50000);
 }
 assert.equal(draft.rows.filter(x=>x.classification==='within_allocation').length,18);
 assert.equal(draft.rows.filter(x=>x.classification==='in_kind').length,6);
 assert.equal(draft.rows.filter(x=>x.classification==='tbc').length,33);
 assert.equal(kwacha(draft.rows.find(x=>x.description==='Contingency – 10%').totalCostLabel),4950);
});
test('document priced but excluded items remain separately flagged, not erased',()=>{
 const excluded=draft.rows.filter(x=>x.classification==='outside_consolidated');
 assert.deepEqual(excluded.map(x=>kwacha(x.totalCostLabel)),[4000,3000,10000]);
 assert.equal(excluded.reduce((n,x)=>n+kwacha(x.totalCostLabel),0),17000);
 assert.equal(draft.reportedPaidMinor,1230000);
 assert.equal(draft.reportedOutstandingMinor,150745000);
 assert.equal(draft.rows.find(x=>x.description.startsWith('Route Measurement')).dueDateText,'Paid');
});
test('replacement is a guarded, atomic archive and targets only March 2027',()=>{
 const src=read('scripts/replace-marathon-2027-budget.mjs');
 assert.match(src,/const PROJECT='kasa-recruite',EVENT_ID='kasa-life-2027-march'/);
 assert.match(src,/if\(!\['--dry-run','--apply'\]\.includes\(mode\)\)/);
 assert.match(src,/batch\.create\(archiveRef/);
 assert.match(src,/batch\.delete\(doc.ref,\{lastUpdateTime:doc.updateTime\}\)/);
 assert.match(src,/batch\.create\(eventRef\.collection\('budgetLines'\)\.doc\(line.id\),line\)/);
 assert.match(src,/await batch.commit\(\)/);
 assert.match(src,/sourceClassification:row.classification/);
 assert.match(src,/reportedPaidClaimMinor:/);
 assert.match(src,/sourceDocumentSha256/);
 assert.match(src,/batch\.create\(db\.collection\('marathonAudit'\)\.doc\(\)/);
 assert.match(src,/if\(existingImport===manifest.sourceDocumentSha256\)/);
 const check=spawnSync(process.execPath,['--check','scripts/replace-marathon-2027-budget.mjs'],{encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
});
test('user sees exact costed totals, TBC, in-kind and unverified reported-payment amounts',()=>{
 const ui=read('src/components/marathon/MarathonEventBudget.tsx');
 const model=read('src/lib/marathon-event-model.ts');
 const api=read('src/app/api/marathon/events/[id]/budget/route.ts');
 assert.match(ui,/Draft-reported paid \(Finance reconciliation pending\)/);
 assert.match(ui,/Outside consolidated total/);
 assert.match(ui,/Within existing allocation/);
 assert.match(ui,/TBC — unpriced/);
 assert.match(ui,/Sponsorship fundraising target \(unconfirmed\)/);
 assert.match(api,/event.budgetContingencyAlreadyIncluded\?0/);
 assert.match(model,/targetRunners:5000,registrationFeeMinor:45000/);
 assert.doesNotMatch(ui,/Import 2027 budget \(80 lines\)/);
 assert.match(read('src/app/api/marathon/events/[id]/budget/seed/route.ts'),/old 80-line budget template has been retired/);
});
