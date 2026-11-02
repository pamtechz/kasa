import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {raceDaySummary,raceDayKinds} from '../../src/lib/marathon-race-day.ts';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');

test('race-day counts are scoped to actual saved operations, not invented runner registrations',()=>{
 assert.deepEqual(raceDaySummary([{kind:'water_station',status:'blocked'},{kind:'medical_team',status:'ready'},
  {kind:'bib_station',status:'active'},{kind:'route_safety',status:'resolved'}]),
 {total:4,ready:1,active:1,blocked:1,resolved:1});
 assert.equal(raceDaySummary([]).total,0);
 assert.equal(raceDayKinds.bib_station,'Bib collection station');
});
test('event operations enforce identity, same-origin, editing authorization, concurrency and closure',()=>{
 const api=read('src/app/api/marathon/race-day/route.ts');
 assert.match(api,/marathonIdentity\(req\)/);
 assert.match(api,/getMarathonEvent\(eventId\)/);
 assert.match(api,/requireEventTaskEdit\(actor,event\)/);
 assert.match(api,/sameOrigin\(req\)/);
 assert.match(api,/\['completed','archived','cancelled'\]/);
 assert.match(api,/previous.eventId!==event.id/);
 assert.match(api,/previous.revision!==parsed.data.expectedRevision/);
 assert.match(api,/marathonAudit/);
 assert.match(api,/limit\(251\)/);
 const board=read('src/components/marathon/MarathonRaceDay.tsx');
 assert.match(board,/registration counts, individual bib collection/i);
 assert.match(board,/canWrite/);
});
test('race-day section is a dedicated route, not an intercepted workspace navigation',()=>{
 const switcher=read('src/components/marathon/MarathonContentSwitch.tsx');
 const sections=read('src/app/marathon/[section]/page.tsx');
 const navigation=read('src/lib/marathon-navigation.ts');
 assert.match(switcher,/path==='\/marathon\/race-day'/);
 assert.match(sections,/MarathonRaceDay/);
 assert.match(navigation,/match\[1\]!=='race-day'/);
 assert.match(read('src/components/marathon/MarathonWorkspace.tsx'),/label:'Race-day desk'/);
});
test('student fee statement verifies linked ownership and never fabricates an unapproved fee quote',()=>{
 const route=read('src/app/api/student/fee-statements/route.ts');
 const math=read('src/lib/finance-operations.ts');
 assert.match(route,/verifiedStudent\(req\)/);
 assert.match(route,/app\?\.applicantUid!==user.uid/);
 assert.match(route,/read/); // financeSnapshot requires an approved quote
 assert.match(math,/readApprovedFeeQuote\(record.feeQuote\)/);
 assert.match(math,/feeMinor===null\|\|receivedMinor===null\?null/);
 assert.match(route,/partial:rows.size>100/);
 assert.match(route,/needsReconciliation/);
 assert.match(read('src/app/(portal)/student-portal/fees/page.tsx'),/student-portal/);
 assert.match(read('src/components/StudentPortal.tsx'),/My Fee Statement/);
});
test('finance reconciliation is read-only and exposes partial scans without silently changing payment data',()=>{
 const route=read('src/app/api/admin/finance/reconciliation/route.ts');
 const score=read('src/lib/finance-operations.ts');
 assert.match(route,/requireCapability\(req,'finance.read'\)/);
 assert.match(route,/where\('formKind','==','student'\)/);
 assert.match(route,/if\(page===39\)partial=true/);
 assert.doesNotMatch(route,/\.update\(|\.create\(|\.set\(/);
 assert.match(score,/missing_quote/);
 assert.match(score,/invalid_payment/);
 assert.match(score,/awaiting_enrollment/);
 assert.match(score,/cdf_awaiting_remittance/);
 assert.match(score,/legacy_receipt_gap/);
 assert.match(read('src/app/(portal)/dashboard/finance/page.tsx'),/Reconciliation queue/);
});
test('all new operations collections remain server-only under Firestore rules',()=>{
 const rules=read('firestore.rules');
 const emulator=read('scripts/integration/firebase-rules.integration.mjs');
 assert.match(rules,/match \/marathonRaceDayItems\/\{id\} \{ allow read, write: if false; \}/);
 assert.match(emulator,/marathonRaceDayItems\/rd-protected/);
});
test('public quick links use approved fee and secure student routes rather than static payment guesses',()=>{
 const home=read('src/app/page.tsx');
 assert.match(home,/href="\/admissions"/);
 assert.match(home,/href="\/fees"/);
 assert.match(home,/href="\/student-portal\/fees"/);
});
