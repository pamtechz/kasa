import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');

test('government CDF approval is separate from verified money received and actual enrollment',()=>{
 const route=read('src/app/api/admin/submissions/[id]/route.ts');
 assert.match(route,/cdf_approved:\['cdf_funds_received'\]/);
 assert.match(route,/cdf_funds_received:\['commission_paid'\]/);
 assert.match(route,/cdfGovernmentPaymentReference/);
 assert.match(route,/cdfBankReceiptReference/);
 assert.match(route,/cdfEnrollmentConfirmed!==true/);
 assert.match(route,/cdfApprovingAuthority/);
 assert.match(route,/cdfDisbursement/);
 assert.match(route,/government_funds_received_verified/);
 assert.match(route,/Math\.round\(paid\*100\)!==Math\.round\(quote!\.total\*100\)/);
 assert.match(route,/status!=='cdf_approved'/);
});
test('student tuition must be fully received as real finance receipts before eligibility',()=>{
 const route=read('src/app/api/admin/submissions/[id]/route.ts');
 assert.match(route,/previous\.paymentVerification\?\.recordedAt/);
 assert.match(route,/evidence!==previous\.paymentVerification\?\.reference/);
 assert.match(route,/Math\.round\(recorded\*100\)!==Math\.round\(quote!\.total\*100\)/);
 assert.match(route,/commissionDecision\(previous\)\.eligible/);
 assert.match(route,/commissionPayoutReferences/);
 assert.match(read('src/app/api/admin/finance/route.ts'),/Recording a receipt never promotes an application/);
});
test('single fail-closed commission rule gates ledger and both referral summaries',()=>{
 const eligibility=read('src/lib/commission-eligibility.ts');
 const funding=read('src/lib/funded-enrollment.ts');
 const ledger=read('src/app/api/admin/commissions/route.ts');
 const student=read('src/app/api/student/referrals/route.ts');
 const agent=read('src/app/api/agent/referrals/route.ts');
 const board=read('src/app/api/agent/leaderboard/route.ts');
 for(const src of [ledger,student,agent,board])assert.match(src,/commissionDecision/);
 assert.match(funding,/readApprovedFeeQuote/);
 assert.match(eligibility,/fundedEnrollment/);
 assert.match(funding,/String\(record\.status\)/);
 assert.match(funding,/cdfDisbursement/);
 assert.match(eligibility,/record\.referralVerified\?\.at/);
 assert.doesNotMatch(board,/fundingMethod === 'cdf' \? 300 : 400/);
 assert.doesNotMatch(agent,/amount: 300/);
 assert.doesNotMatch(student,/commissionAmount,\n        currency/);
 assert.doesNotMatch(ledger,/\['payment_verified','cdf_approved','commission_paid'\]/);
});
test('public and staff admission submission cannot pre-approve or issue CDF offers',()=>{
 const submit=read('src/app/api/public/forms/[slug]/submit/route.ts');
 const manual=read('src/app/api/admin/submissions/route.ts');
 const intake=read('src/app/(portal)/dashboard/intake/page.tsx');
 assert.match(submit,/finalStatus='submitted'/);
 assert.match(submit,/autoApproved=false/);
 assert.doesNotMatch(submit,/finalStatus='letter_issued'/);
 assert.match(manual,/const initialStatus:SubmissionStatus='submitted'/);
 assert.match(intake,/Automatic-approval flags in historical policies are ignored/);
});
test('student ID, payouts and approvals have distinct proof and state',()=>{
 const card=read('src/app/api/public/submissions/[id]/id-card/route.ts');
 const route=read('src/app/api/admin/submissions/[id]/route.ts');
 const admission=read('src/app/(portal)/dashboard/applications/[id]/page.tsx');
 assert.doesNotMatch(card,/\['cdf_approved','payment_verified','commission_paid'\]/);
 assert.match(card,/fundedEnrollment\(data\)\.funded/);
 assert.match(admission,/Government disbursement/);
 assert.match(admission,/KASA bank remittance/);
 assert.match(route,/commissionDecision/);
});
