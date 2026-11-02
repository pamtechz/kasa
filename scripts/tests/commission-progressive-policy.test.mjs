import {commissionPolicyFromSettings,commissionTotalMinor,advanceEntitlementMinor} from '../../src/lib/commission-payment-policy.ts';
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

test('10% progressive commissions follow verified installments in integer ngwee',()=>{
 const policy=commissionPolicyFromSettings({commissionPaymentMode:'progressive',
  commissionRateType:'percentage',commissionPercentBps:1000,commissionAmountPaid:400});
 assert.equal(commissionTotalMinor(1000000,policy),100000); // K1,000 on a K10,000 course
 assert.equal(advanceEntitlementMinor(1000000,200000,100000,policy.mode),20000); // K200 on K2,000 paid
 assert.equal(advanceEntitlementMinor(1000000,400000,100000,policy.mode)-20000,20000);
 assert.equal(advanceEntitlementMinor(1000000,1000000,100000,policy.mode),100000);
});
test('early full payment is an explicit risk choice, while default defers early transfers',()=>{
 const settings=commissionPolicyFromSettings({commissionAmountPaid:500});
 assert.equal(settings.mode,'after_full_enrollment');
 assert.equal(advanceEntitlementMinor(1000000,200000,50000,settings.mode),0);
 assert.equal(advanceEntitlementMinor(1000000,100,50000,'full_on_first_payment'),50000);
 assert.equal(commissionTotalMinor(1000000,settings),50000);
});
test('early payments reject over-reconciled tuition and impossible monetary values',()=>{
 assert.throws(()=>advanceEntitlementMinor(10000,10001,1000,'progressive'));
 assert.throws(()=>advanceEntitlementMinor(10000,-1,1000,'progressive'));
 assert.throws(()=>commissionTotalMinor(0,commissionPolicyFromSettings({})));
});
