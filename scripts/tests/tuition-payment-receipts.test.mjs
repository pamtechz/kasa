import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');

test('finance payment recording is transactional and generates an immutable receipt, not instant commission',()=>{
 const finance=read('src/app/api/admin/finance/route.ts');
 assert.match(finance,/requireCapability\(req,'finance.record'\)/);
 assert.match(finance,/readApprovedFeeQuote\(app.feeQuote\)/);
 assert.match(finance,/Math.round\(newPaidTotal \* 100\) > Math.round\(approvedQuote.total \* 100\)/);
 assert.match(finance,/tx.create\(db.collection\('tuitionReceipts'\).doc\(receiptId\)/);
 assert.match(finance,/kind:'tuition_payment_receipt'/);
 assert.match(finance,/kind:'commission_eligibility_review'/);
 assert.match(finance,/Math.round\(newPaidTotal\*100\)===Math.round\(approvedQuote.total\*100\)/);
 assert.doesNotMatch(finance,/changes\.commission=/);
 assert.match(finance,/Recording a receipt never promotes an application to payment_verified/);
});

test('student can only list/download own linked application receipts',()=>{
 const route=read('src/app/api/tuition-receipts/route.ts');
 const secure=read('src/lib/tuition-receipt-server.ts');
 const pdf=read('src/app/api/tuition-receipts/[id]/pdf/route.ts');
 assert.match(route,/application\.data\(\)\?\.applicantUid!==viewer.uid/);
 assert.match(route,/where\('submissionId','==',submissionId\)/);
 assert.match(secure,/record\.submissionId/);
 assert.match(secure,/application.data\(\)\?\.applicantUid!==viewer.uid/);
 assert.match(pdf,/readTuitionReceipt\(req,id\)/);
 assert.match(pdf,/PDFDocument.create/);
 assert.match(pdf,/private, no-store/);
});

test('finance and student portals expose per-application tuition PDFs',()=>{
 const finance=read('src/app/(portal)/dashboard/finance/[id]/[action]/page.tsx');
 const student=read('src/app/(portal)/student-portal/applications/page.tsx');
 const widget=read('src/components/TuitionReceiptList.tsx');
 assert.match(finance,/<TuitionReceiptList submissionId=\{item.id\}\/>/);
 assert.match(student,/<TuitionReceiptList submissionId=\{app.id\}\/>/);
 assert.match(widget,/View \/ download receipts/);
 assert.match(widget,/api\/tuition-receipts/);
});

test('commission is granted to a verified active referrer, either agent or student, only at the funded-enrollment gate',()=>{
 const status=read('src/app/api/admin/submissions/[id]/route.ts');
 const eligibility=read('src/lib/commission-eligibility.ts');
 const funded=read('src/lib/funded-enrollment.ts');
 assert.match(status,/\['student','agent'\]\.includes/);
 assert.match(status,/referrer\.data\(\)\?\.active!==true/);
 assert.match(status,/Self-referral cannot earn commission/);
 assert.match(status,/commission_earned/);
 assert.match(status,/referralVerified!==true/);
 assert.match(eligibility,/fundedEnrollment\(record\)/);
 assert.match(funded,/p\.verifiedAt/);
});

test('tuition receipts deny direct Firestore client access',()=>{
 assert.match(read('firestore.rules'),/match \/tuitionReceipts\/\{id\} \{ allow read, write: if false; \}/);
 assert.match(read('scripts/integration/firebase-rules.integration.mjs'),/tuitionReceipts\/private1/);
});
