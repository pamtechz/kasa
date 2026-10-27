import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const tariff=read('src/app/api/admin/fee-tariffs/route.ts');
const issuance=read('src/app/api/admin/fee-quotes/route.ts');
const ledger=read('src/app/api/admin/finance/route.ts');
const permissions=read('src/lib/permissions.ts');
const ui=read('src/app/(portal)/dashboard/finance/page.tsx');

test('tariffs are created by the super admin only, immutable, formally documented and versioned',()=>{
 assert.match(tariff,/operator\(req,\['super_admin'\]\)/);
 assert.match(tariff,/confirmedApproval!==true/);
 assert.match(tariff,/approvalReference/);
 assert.match(tariff,/tx\.create\(ref,record\)/);
 assert.doesNotMatch(tariff,/export async function (PUT|PATCH|DELETE)/);
 assert.match(tariff,/readApprovedFeeQuote/);
});
test('historical reconciliation requires evidence and does not overwrite a fee snapshot or change receipts',()=>{
 assert.match(issuance,/requireCapability\(req,'finance.record'\)/);
 assert.match(issuance,/confirmedProgrammeAndPackage!==true/);
 assert.match(issuance,/reconciliationEvidence/);
 assert.match(issuance,/app\.feeQuote!==undefined&&app\.feeQuote!==null/);
 assert.match(issuance,/agreementReference\.length<8/);
 assert.match(issuance,/tx\.update\(submissionRef,\{feeQuote:issued/);
 assert.match(issuance,/existing payment history exceeds this tariff/i);
 assert.doesNotMatch(issuance,/paymentVerification:\s*\{/);
});
test('finance does not fabricate fees or accept unquoted receipts',()=>{
 assert.match(ledger,/!approvedQuote\) throw new HttpError\(409/);
 assert.match(ledger,/Math\.round\(newPaidTotal \* 100\)/);
 assert.match(ledger,/financialTotalsPartial/);
 assert.match(ledger,/truncated/);
 assert.match(ui,/\/dashboard\/finance\//);
 const editor=read('src/app/(portal)/dashboard/finance/[id]/[action]/page.tsx');
 assert.match(editor,/FinanceQuoteReconcile/);
 assert.doesNotMatch(ledger,/tuitionFee = 8200/);
 assert.doesNotMatch(ui,/: '1000'/);
});
test('new finance APIs have explicit capability mapping and bypass neither server roles nor Firestore rules',()=>{
 assert.match(permissions,/fee-tariffs/);
 assert.match(permissions,/fee-quotes/);
 assert.match(tariff,/sameOrigin\(req\)/);
 assert.match(issuance,/sameOrigin\(req\)/);
 const rules=read('firestore.rules');
 assert.match(rules,/match \/\{document=\*\*\} \{ allow read, write: if false/);
 const security=read('src/lib/security.ts');
 assert.match(security,/if\(!cap\|\|!can\(p\.role,cap\)\)/);
});

test('acceptance letters never invent applicant financial figures; legacy letters retain a reconciliation disclaimer',()=>{
 const admin=read('src/app/api/admin/submissions/[id]/letter/route.ts');
 const publicLetter=read('src/app/api/public/submissions/[id]/letter/route.ts');
 const pdf=read('src/lib/pdf-acceptance-pack.ts');
 const mutations=read('src/app/api/admin/submissions/[id]/route.ts');
 for(const route of [admin,publicLetter]){
  assert.match(route,/readApprovedFeeQuote\(data\.feeQuote\)/);
  assert.match(route,/suppressProposedFees: !approvedFee/);
  assert.doesNotMatch(route,/K8,200|K17,200|K9,000|40% registration deposit/);
 }
 assert.match(pdf,/if \(data\.approvedBreakdown\)/);
 assert.match(pdf,/data\.suppressProposedFees/);
 assert.match(mutations,/status==='letter_issued'&&!readApprovedFeeQuote\(previous\.feeQuote\)/);
});
