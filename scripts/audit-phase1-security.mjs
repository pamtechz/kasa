#!/usr/bin/env node
/**
 * KASA Phase 1 release AUDIT: read-only aggregate findings.
 * Intentionally prints no email addresses, UIDs, application references,
 * passwords, download tokens, notification text or document IDs.
 *
 * Requires: --project <exact FIREBASE_PROJECT_ID> --confirm-read-only
 * Credentials come from existing admin environment; NEVER from CLI args.
 * Running the audit does not revoke credentials or deploy rules.
 */
import {FieldPath} from 'firebase-admin/firestore';

function flag(name){
 const i=process.argv.indexOf(name);
 return i>=0?process.argv[i+1]:null;
}
const project=flag('--project');
if(!project || !process.argv.includes('--confirm-read-only') || project!==process.env.FIREBASE_PROJECT_ID){
 console.error('Read-only audit needs --project <exact FIREBASE_PROJECT_ID> --confirm-read-only.');
 process.exit(2);
}
if(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST){
 console.error('This operational report targets the configured project, not emulators.');
 process.exit(2);
}
const {db,auth}=await import('./_firebase.mjs');

async function paginate(name,visit){
 let cursor=null;
 let scanned=0;
 do{
  let q=db.collection(name).orderBy(FieldPath.documentId()).limit(250);
  if(cursor)q=q.startAfter(cursor);
  const page=await q.get();
  for(const doc of page.docs){visit(doc.data()||{});scanned++;}
  if(page.empty || page.size<250)break;
  cursor=page.docs[page.docs.length-1];
 }while(true);
 return scanned;
}

const warnings=[];
const counters={
 notifications:{total:0,withPossibleExposedPassword:0,withPersonalApplicationReference:0},
 submissions:{total:0,withLegacyDownloadToken:0,linkedToAccount:0,unlinked:0},
 auth:{total:0,emailUnverified:0,disabled:0},
};
const passwordPattern=/(?:temporary|temp|initial|one[-\s]?time)?\s*password\s*[:=\-]\s*[^\s]+/i;

counters.notifications.total=await paginate('notificationOutbox',data=>{
 const body=String(data.title||'')+'\n'+String(data.message||'');
 if(passwordPattern.test(body))counters.notifications.withPossibleExposedPassword++;
 if(data.reference || data.submissionId)counters.notifications.withPersonalApplicationReference++;
});
counters.submissions.total=await paginate('submissions',data=>{
 if(typeof data.downloadToken==='string'&&data.downloadToken.length>0)
  counters.submissions.withLegacyDownloadToken++;
 if(typeof data.applicantUid==='string'&&data.applicantUid.length>0)
  counters.submissions.linkedToAccount++;
 else counters.submissions.unlinked++;
});
let pageToken;
do{
 const page=await auth.listUsers(1000,pageToken);
 for(const user of page.users){
  counters.auth.total++;
  if(!user.emailVerified)counters.auth.emailUnverified++;
  if(user.disabled)counters.auth.disabled++;
 }
 pageToken=page.pageToken;
}while(pageToken);

if(counters.notifications.withPossibleExposedPassword>0)warnings.push('Historic notification content may contain passwords: investigate and revoke affected credentials.');
if(counters.auth.emailUnverified>0)warnings.push('Unverified Auth users exist; investigate provenance and access privileges.');
if(counters.submissions.withLegacyDownloadToken>0)warnings.push('Legacy bearer download links remain active until carefully migrated or rotated.');
warnings.push('This audit does not establish whether any historic password was used, viewed, or transmitted off-platform.');
warnings.push('Preserve an authorized Firestore backup before any mutation or incident-response action.');

console.log(JSON.stringify({
 kind:'KASA_PHASE1_READ_ONLY_AGGREGATE_AUDIT',
 projectVerified:true,
 generatedAt:new Date().toISOString(),
 counters,warnings,
 changedRecords:0,
 automaticallyRevokedCredentials:0,
 authorizationTestsIncluded:false
},null,2));
if(counters.notifications.withPossibleExposedPassword>0)process.exitCode=3;
