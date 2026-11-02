import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');

test('Admin can choose progressive, full-after-first verified payment or fully deferred commission',()=>{
 const policy=src('src/lib/commission-payment-policy.ts');
 const settings=src('src/app/api/admin/settings/commissions/route.ts');
 const view=src('src/app/(portal)/dashboard/settings/commissions/page.tsx');
 for(const mode of ['progressive','full_on_first_payment','after_full_enrollment']){
  assert.ok(policy.includes("'"+mode+"'"));
  assert.ok(settings.includes(mode));
  assert.ok(view.includes('value="'+mode+'"'));
 }
 assert.match(policy,/Math\.floor\(fullMinor\*paidMinor\/feeMinor\)/);
 assert.match(policy,/commissionTotalMinor/);
 assert.match(settings,/commissionPercentBps:percentageBps/);
 assert.match(settings,/commission.policy_updated/);
 assert.match(view,/higher financial risk/i);
});

test('Every progressive payout is independently evidenced, cumulative, capped and receives a new receipt',()=>{
 const advance=src('src/app/api/admin/commissions/advance/route.ts');
 assert.match(advance,/tx\.get\(db\.collection\('tuitionReceipts'\)/);
 assert.match(advance,/tx\.get\(db\.collection\('fundingVerifications'\)/);
 assert.match(advance,/studentReceipt\.data\(\)\?\.totalPaidMinor!==paidMinor/);
 assert.match(advance,/Math\.round\(body\.amount\*100\)/);
 assert.match(advance,/maxAllowed-pastMinor/);
 assert.match(advance,/pastMinor\+requestedMinor/);
 assert.match(advance,/tx\.create\(proofRef/);
 assert.match(advance,/tx\.create\(receiptRef/);
 assert.match(advance,/tx\.set\(advanceRef/);
 assert.match(advance,/body\.referralVerified!==true\|\|body\.paymentVerified!==true/);
 assert.match(advance,/previous\?\.policyMode/);
 assert.match(advance,/\['agent','student'\]/);
});

test('Final funded-enrollment commission deducts real advances without fabricating a zero payment',()=>{
 const status=src('src/app/api/admin/submissions/[id]/route.ts');
 const agent=src('src/app/api/agent/payout-request/route.ts');
 assert.match(status,/advanceDoc\?\.exists\?Number\(advanceDoc\.data\(\)\?\.fullRateMinor\)/);
 assert.match(status,/remainingMinor=fullMinor-advanceMinor/);
 assert.match(status,/remainingMinor===0/);
 assert.match(status,/settledByAdvances:true/);
 assert.match(status,/remainingMinor\//);
 assert.match(agent,/amountMinor=Math\.round\(decision\.amount\*100\)-advancedMinor/);
});
