import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('only active student profiles can access referrals and referral code creation never reactivates accounts',()=>{
 const route=read('src/app/api/student/referrals/route.ts');
 const identity=read('src/lib/referral-identity.ts');
 assert.match(route,/profile\.data\(\)\?\.active!==true/);
 assert.match(route,/profile\.data\(\)\?\.role!=='student'/);
 assert.doesNotMatch(route,/role:\s*profileSnap\.data\(\)\?\.role\s*\|\|/);
 assert.doesNotMatch(route,/active:\s*true/);
 assert.match(identity,/data\?\.active!==true\|\|data\?\.role!=='student'/);
 assert.match(identity,/tx\.update\(ref,\{agentCode:generated,isStudent:true/);
 assert.match(identity,/tx\.create\(claim,/);
});

test('public referral attribution uses unique active owner profile, not submission reference fallback',()=>{
 const submit=read('src/app/api/public/forms/[slug]/submit/route.ts');
 const helper=read('src/lib/referral-identity.ts');
 assert.match(submit,/agentId=await referralOwner\(String\(body\.agentCode\),applicantUid\)/);
 assert.doesNotMatch(submit,/sub\.docs\[0\]\.id/);
 assert.match(helper,/where\('agentCode','==',code\)\.limit\(2\)/);
 assert.match(helper,/found\.size!==1/);
 assert.match(helper,/active!==true/);
 assert.match(helper,/Self-referrals are not eligible/);
});

test('agent appointments require existing real Auth user and reserve code without conflicting owner',()=>{
 const route=read('src/app/api/admin/agents/route.ts');
 assert.match(route,/if\(!user\)throw new HttpError\(409/);
 assert.match(route,/if\(user\.disabled\)/);
 assert.match(route,/duplicates\.docs\.some\(d=>d\.id!==uid\)/);
 assert.match(route,/tx\.create\(claimRef/);
});

test('direct candidate POST bypasses are disabled in favor of published form and scoped fingerprint',()=>{
 for(const path of ['src/app/api/agent/referrals/route.ts','src/app/api/student/referrals/route.ts']){
  const route=read(path);
  assert.match(route,/export async function POST/);
  assert.match(route,/throw new HttpError\(409,'Register referred candidates using your official referral link/);
  assert.doesNotMatch(route,/newRecord: ApplicantRecord/);
 }
 const ui=read('src/app/(portal)/dashboard/referrals/page.tsx');
 assert.match(ui,/window\.location\.assign\(data\.referralLink\)/);
 const form=read('src/app/api/public/forms/[slug]/submit/route.ts');
 assert.match(form,/applicationDedupe/);
});

test('agent referral dashboard receives real link and verified commission totals',()=>{
 const api=read('src/app/api/agent/referrals/route.ts');
 const page=read('src/app/(portal)/agent-portal/page.tsx');
 assert.match(api,/referralLink/);
 assert.match(api,/referralsCount:referrals\.length/);
 assert.match(api,/totalEarned:eligible\.reduce/);
 assert.match(api,/pendingCommission:/);
 assert.match(page,/referralData\?\.totalEarned/);
 assert.doesNotMatch(page,/BONUS UNLOCKED/);
});

test('payout request derives amount from the verified submission and reserves it atomically',()=>{
 const route=read('src/app/api/agent/payout-request/route.ts');
 const settlement=read('src/app/api/admin/submissions/[id]/route.ts');
 assert.match(route,/commissionDecision\(record\)/);
 assert.match(route,/record\.agentId!==actor\.uid/);
 assert.match(route,/record\.commission\?\.paidAt/);
 assert.match(route,/tx\.create\(reservation,/);
 assert.match(route,/if\(locked\.exists\)/);
 assert.match(route,/Object\.prototype\.hasOwnProperty\.call\(body,'amount'\)/);
 assert.match(route,/tx\.update\(reserve,\{status:'approved'/);
 assert.match(route,/tx\.delete\(reserve\)/);
 assert.match(settlement,/request\.data\(\)\?\.status!=='approved'/);
 assert.match(settlement,/tx\.update\(requestRef,\{status:'settled'/);
 assert.match(settlement,/commissionPayoutReferences/);
});

test('payout private collections are inaccessible to Firestore clients',()=>{
 const rules=read('firestore.rules');
 for(const name of ['payoutRequests','payoutReservations','referralCodes'])
  assert.match(rules,new RegExp('match /'+name+'/\\{id\\} \\{ allow read, write: if false; \\}'));
});

test('agent tiers count only verified enrollments in the selected month, and incomplete scans are identified',()=>{
 const board=read('src/app/api/agent/leaderboard/route.ts');
 assert.match(board,/startsWith\(monthKey\)/);
 assert.match(board,/lifetimeConfirmedEnrollments/);
 assert.match(board,/partial/);
 assert.doesNotMatch(board,/bonusAmount: 1000/);
});
