import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const source=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');

test('policy uses exactly two future-funding rates; general settings never overwrites them',()=>{
 const admin=source('src/app/(portal)/dashboard/settings/commissions/page.tsx');
 const rate=source('src/app/api/admin/settings/commissions/route.ts');
 const general=source('src/app/api/admin/settings/route.ts');
 const existing=source('src/app/api/admin/submissions/[id]/route.ts');
 for(const field of ['commissionAmountPaid','commissionAmountCdf','referralsEnabled']){
  assert.match(rate,new RegExp(field));
 }
 assert.match(rate,/commission.policy_updated/);
 assert.match(rate,/typeof value!=='number'/);
 assert.match(rate,/Math.abs\(value\*100-Math.round\(value\*100\)\)/);
 assert.match(rate,/commissionPolicyUpdatedBy:actor.uid/);
 assert.doesNotMatch(general,/commissionAmountPaid:paidAmount/);
 assert.doesNotMatch(general,/commissionAmountCdf:cdfAmount/);
 assert.match(admin,/CDF approval letter alone does not qualify/);
 assert.match(existing,/commissionPolicyFromSettings\(settings\)/);
 assert.match(existing,/settings.commissionAmountCdf/);
});

test('every recorded payout transaction also creates a recipient-scoped proof and alert atomically',()=>{
 const route=source('src/app/api/admin/submissions/[id]/route.ts');
 assert.match(route,/commissionPayments'\)\.doc\(id\)/);
 assert.match(route,/tx.create\(db.collection\('commissionReceipts'\)\.doc\(id\)/);
 assert.match(route,/recipientUid:previous.agentId/);
 assert.match(route,/transactionId:paymentReference/);
 assert.match(route,/status:'awaiting_confirmation'/);
 assert.match(route,/commission_payout_receipt/);
 assert.match(route,/tx.create\(payoutRef/);
});

test('recipient must independently enter and match amount and transaction ID; disputes are separate and auditable',()=>{
 const route=source('src/app/api/commission-receipts/route.ts');
 assert.match(route,/operator\(req,\[\.\.\.roles\]\)/);
 assert.match(route,/receipt.recipientUid!==user.uid/);
 assert.match(route,/receipt.status!=='awaiting_confirmation'/);
 assert.match(route,/amountReceived/);
 assert.match(route,/actualMinor===receipt.amountMinor/);
 assert.match(route,/transactionId.toUpperCase\(\)===receipt.transactionId.trim\(\).toUpperCase\(\)/);
 assert.match(route,/action==='confirm'&&!matches/);
 assert.match(route,/status:result/);
 assert.match(route,/commission.receipt_/);
 assert.match(route,/commission_receipt_dispute/);
 assert.doesNotMatch(route,/tx.update\(db.collection\('commissionPayments'/);
});

test('private PDF has explicit proof limitation and no unauthenticated download access',()=>{
 const route=source('src/app/api/commission-receipts/[id]/pdf/route.ts');
 assert.match(route,/operator\(req,/);
 assert.match(route,/item.recipientUid!==actor.uid/);
 assert.match(route,/PDFDocument.create\(\)/);
 assert.match(route,/recipient response/);
 assert.match(route,/not independent bank settlement evidence/);
 assert.match(route,/private, no-store/);
});

test('recipient and admin portals expose the correct payment history workflow',()=>{
 const box=source('src/components/CommissionReceiptCenter.tsx');
 assert.match(box,/I checked my own account or statement/);
 assert.match(box,/Report a problem/);
 assert.match(box,/Download PDF/);
 assert.match(box,/commission-receipts/);
 const agent=source('src/app/(portal)/agent-portal/payouts/page.tsx');
 const student=source('src/app/(portal)/student-portal/referrals/page.tsx');
 const admin=source('src/app/(portal)/dashboard/payouts/page.tsx');
 assert.match(agent,/<CommissionReceiptCenter\/>/);
 assert.match(student,/<CommissionReceiptCenter\/>/);
 assert.match(admin,/<CommissionReceiptCenter admin\/>/);
});

test('Firestore denies client reading financial receipt records',()=>{
 const rules=source('firestore.rules');
 const integration=source('scripts/integration/firebase-rules.integration.mjs');
 assert.match(rules,/match \/commissionReceipts\/\{id\} \{ allow read, write: if false; \}/);
 assert.match(integration,/commissionReceipts\/private1/);
});
