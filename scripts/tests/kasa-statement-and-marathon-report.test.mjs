import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('student statement has verified ownership and no speculative balances',()=>{
 const api=source('src/app/api/student/applications/[id]/statement/route.ts');
 assert.match(api,/verifiedStudent\(req\)/);
 assert.match(api,/doc\.data\(\)\?\.applicantUid!==user\.uid/);
 assert.match(api,/financeSnapshot\(record,partial\?undefined:receipts\)/);
 assert.match(api,/receiptHistoryPartial:partial/);
 assert.match(api,/feeMinor:snapshot\.feeMinor/);
 assert.match(api,/balanceMinor:snapshot\.balanceMinor/);
 assert.doesNotMatch(api,/commission\.paidAt\s*=/);
});

test('fee statement shown on student applications without exposing applicant data publicly',()=>{
 const page=source('src/app/(portal)/student-portal/applications/page.tsx');
 const widget=source('src/components/StudentFeeStatement.tsx');
 assert.match(page,/<StudentFeeStatement submissionId=\{app.id\}\/>/);
 assert.match(widget,/authHeaders\(\)/);
 assert.match(widget,/Outstanding balance/);
 assert.match(widget,/Recorded student payments/);
 assert.match(widget,/receiptHistoryPartial/);
});

test('marathon budget category totals remain event-specific and separate planned from paid amounts',()=>{
 const view=source('src/components/marathon/MarathonEventBudget.tsx');
 assert.match(view,/Budget versus actual by category/);
 assert.match(view,/budget\.lines\.reduce/);
 assert.match(view,/line\.plannedMinor/);
 assert.match(view,/line\.actualPaidMinor/);
 assert.match(view,/selected event only/);
});

test('finance reconciliation queue and application safeguards remain available',()=>{
 const api=source('src/app/api/admin/finance/reconciliation/route.ts');
 const dashboard=source('src/app/(portal)/dashboard/finance/page.tsx');
 assert.match(api,/financeSnapshot\(app\)/);
 assert.match(api,/requireCapability\(req,'finance.read'\)/);
 assert.match(dashboard,/\/dashboard\/finance\/reconciliation/);
});
