import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(file)=>readFileSync(new URL('../../'+file,import.meta.url),'utf8');

test('Firestore clients cannot directly forge application decisions or mutate profiles',()=>{
 const rules=source('firestore.rules');
 assert.match(rules,/match \/\{document=\*\*\}/);
 assert.doesNotMatch(rules,/allow create: if request\.resource\.data\.keys\(\)/);
 assert.match(rules,/match \/profiles\/\{uid\}/);
 assert.match(rules,/allow list, create, update, delete: if false/);
});
test('Storage private uploads and documents are never readable through browser rules',()=>{
 const rules=source('storage.rules');
 assert.match(rules,/match \/\{allPaths=\*\*\}/);
 assert.match(rules,/allow read, write: if false/);
 assert.doesNotMatch(rules,/allow read, write: if isSignedIn/);
});
test('Every public document route requires the common verified identity check',()=>{
 for(const path of ['letter','enrollment-form','id-card']){
  const file=source('src/app/api/public/submissions/[id]/'+path+'/route.ts');
  assert.match(file,/await authorizeSubmissionDocument\(req,data\)/);
  assert.doesNotMatch(file,/if \(!authHeader\)/);
 }
 const helper=source('src/lib/submission-access.ts');
 assert.match(helper,/adminAuth\.verifyIdToken\(jwt,true\)/);
 assert.match(helper,/record\.applicantUid===identity\.uid/);
 assert.match(helper,/timingSafeEqual/);
});
test('Anonymous application form cannot create an already-verified Firebase account',()=>{
 const route=source('src/app/api/public/forms/[slug]/submit/route.ts');
 assert.doesNotMatch(route,/adminAuth\.createUser\(/);
 assert.doesNotMatch(route,/tempPassword/);
 assert.match(route,/applicantUid=claims\.uid/);
});
test('Provisioning no longer persists or returns plaintext passwords',()=>{
 const route=source('src/app/api/admin/users/provision/route.ts');
 assert.doesNotMatch(route,/adminAuth\.createUser\(/);
 assert.doesNotMatch(route,/Math\.random/);
 assert.match(route,/if \(!authUser\.emailVerified\)/);
 assert.match(route,/tempPassword: null/);
 assert.doesNotMatch(route,/Temporary password:/);
});
test('Personal notifications cannot delete the globally read outbox',()=>{
 const route=source('src/app/api/notifications/route.ts');
 assert.match(route,/canReadNotice/);
 assert.match(route,/safeNotice/);
 assert.doesNotMatch(route,/\.where\('read', '==', true\)/);
});

test('Enrollment PDFs preserve configured positioning and do not fabricate identity or consent',()=>{
 const route=source('src/app/api/public/submissions/[id]/enrollment-form/route.ts');
 assert.match(route,/const offsets = letterSettingsDoc\.data\(\)\?\.enrollmentFormOffsets \|\| \{\}/);
 assert.match(route,/generateEnrollmentFormPdf\(formData, offsets\)/);
 assert.doesNotMatch(route,/2004-05-14|applicant@example\.com|photoPublicityConsent: true/);
 assert.match(route,/answers\['photo-publicity-consent'\]/);
});

test('WhatsApp webhook validates signed Meta messages before accessing application data',()=>{
 const route=source('src/app/api/public/whatsapp/webhook/route.ts');
 assert.match(route,/x-hub-signature-256/);
 assert.match(route,/createHmac\('sha256'/);
 assert.match(route,/timingSafeEqual/);
 assert.match(route,/WHATSAPP_APP_SECRET/);
 assert.match(route,/registeredPhones\.includes\(phone\)/);
 assert.match(route,/whatsappWebhookDeliveries/);
 assert.doesNotMatch(route,/kasa_whatsapp_verify_token_2027|app\.downloadToken/);
 assert.doesNotMatch(route,/replyMessage.*letterUrl/);
});
test('Manual OCR transcription cannot automatically verify documents or advance status',()=>{
 const route=source('src/app/api/admin/submissions/[id]/ocr/route.ts');
 assert.match(route,/automatedVerified: false/);
 assert.match(route,/source: 'manual_transcription'/);
 assert.match(route,/needsReview: true/);
 assert.doesNotMatch(route,/\x60\x24\{claimedName\} \x24\{claimedNrc\}\x60/);
 assert.doesNotMatch(route,/status: result\.needsReview/);
});

test('Finance records receipts atomically without granting verified enrollment',()=>{
 const route=source('src/app/api/admin/finance/route.ts');
 assert.match(route,/db\.runTransaction\(/);
 assert.match(route,/tx\.create\(verificationRef/);
 assert.match(route,/payment_recorded_pending_enrollment_verification/);
 assert.match(route,/verificationPending:/);
 assert.doesNotMatch(route,/status: 'payment_verified'/);
 assert.match(route,/if \(prior\.exists\) throw new HttpError\(409/);
});
test('Commission mutation cannot bypass the canonical approval and payout ledger',()=>{
 const route=source('src/app/api/admin/commissions/route.ts');
 const page=source('src/app/(portal)/dashboard/commissions/page.tsx');
 assert.match(route,/updateApplicationStatus\(transitionRequest/);
 assert.match(route,/status:'commission_paid'/);
 assert.doesNotMatch(route,/manual_adjustment|Direct Transfer|Number\(body\.amount\)\|\|300/);
 assert.doesNotMatch(page,/Manual commission|Void All|Void Selected/);
});
test('Provisioning does not assign referral codes to students or store undefined properties',()=>{
 const route=source('src/app/api/admin/users/provision/route.ts');
 assert.match(route,/studentCode: studentCode \|\| FieldValue\.delete\(\)/);
 assert.match(route,/agentCode: agentCode \|\| FieldValue\.delete\(\)/);
 assert.doesNotMatch(route,/phone: phone \|\| undefined/);
 assert.doesNotMatch(route,/if \(studentCode\) profileData\.agentCode/);
});

test('Custom acceptance PDFs reject internal servers, redirects, and oversized files',()=>{
 const loader=source('src/lib/custom-acceptance-pdf.ts');
 assert.match(loader,/KASA_ALLOWED_PDF_HOSTS/);
 assert.match(loader,/isIP\(hostname\)/);
 assert.match(loader,/target\.protocol!=='https:'/);
 assert.match(loader,/redirect:'error'/);
 assert.match(loader,/MAX_PDF_BYTES/);
 assert.match(loader,/checkPdf\(Buffer\.concat/);
 for(const route of [
  'src/app/api/admin/submissions/[id]/letter/route.ts',
  'src/app/api/public/submissions/[id]/letter/route.ts',
  'src/app/api/admin/settings/acceptance-letter/preview/route.ts'
 ]){
  const content=source(route);
  assert.match(content,/loadCustomAcceptancePdf\(/);
  assert.doesNotMatch(content,/Response\.redirect\(/);
  assert.doesNotMatch(content,/fetch\(pdfUrl|fetch\(url/);
 }
});

test('Bulk acceptance notices go only to linked applicants; no fake email send counts',()=>{
 const endpoint=source('src/app/api/admin/submissions/batch-email/route.ts');
 const page=source('src/app/(portal)/dashboard/applications/page.tsx');
 assert.match(endpoint,/recipient: 'student'/);
 assert.match(endpoint,/recipientUid,/);
 assert.match(endpoint,/if\(!recipientUid\)/);
 assert.match(endpoint,/emailSentCount: 0/);
 assert.doesNotMatch(endpoint,/recipient: 'all'/);
 assert.doesNotMatch(endpoint,/sentCount: acceptedList\.length/);
 assert.match(page,/Notify linked students/);
});
test('Spreadsheet export guards formula-prefixed applicant input',()=>{
 const endpoint=source('src/app/api/admin/submissions/batch-download/route.ts');
 assert.match(endpoint,/protectedValue/);
 assert.match(endpoint,/protectedValue =/);
 assert.match(endpoint,/test\(plain\)/);
 assert.match(endpoint,/protectedValue\.replace/);
});
test('Legacy application notices are not broadcast to unrelated learners or agents',()=>{
 const endpoint=source('src/app/api/notifications/route.ts');
 assert.match(endpoint,/notice\.reference \|\| notice\.submissionId/);
 assert.match(endpoint,/\['student','agent'\]\.includes\(user\.role\)/);
});
