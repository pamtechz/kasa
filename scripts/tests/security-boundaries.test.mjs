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
