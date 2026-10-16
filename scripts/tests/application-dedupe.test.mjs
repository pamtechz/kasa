import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {enrollmentScope,scopedFingerprint} from '../../src/lib/application-dedupe.ts';

const fields=[
 {id:'contact',label:'Email',type:'email',required:true},
 {id:'course-choice',label:'Course',type:'select',optionsSource:'programmes',required:true},
 {id:'intake-choice',label:'Intake',type:'select',optionsSource:'intakes',required:true}
];

test('repeat submission for the same course and intake has the same key',()=>{
 const answers={'contact':'user@example.com','course-choice':'Poultry','intake-choice':'January 2027'};
 assert.equal(scopedFingerprint('student', 'user@example.com',fields,answers),
  scopedFingerprint('student','user@example.com',[...fields].reverse(),{...answers,'course-choice':' POULTRY '}));
});

test('new intake or course produces a different key for the same verified contact',()=>{
 const january={'course-choice':'Poultry','intake-choice':'January 2027'};
 const july={'course-choice':'Poultry','intake-choice':'July 2027'};
 const different={'course-choice':'Fish farming','intake-choice':'January 2027'};
 assert.notEqual(scopedFingerprint('student','user@example.com',fields,january),scopedFingerprint('student','user@example.com',fields,july));
 assert.notEqual(scopedFingerprint('student','user@example.com',fields,january),scopedFingerprint('student','user@example.com',fields,different));
});

test('the selection source and administrator field key distinguish inputs',()=>{
 const a={'course-choice':'Poultry'};
 const changed=fields.map(f=>f.id==='course-choice'?{...f,optionsSource:'intakes'}:f);
 assert.notEqual(enrollmentScope(fields,a),enrollmentScope(changed,a));
});

test('agents without intake or course questions still deduplicate by contact and form',()=>{
 const agentFields=[fields[0]];
 assert.equal(scopedFingerprint('agent','user@example.com',agentFields,{}),scopedFingerprint('agent','user@example.com',agentFields,{}));
 assert.notEqual(scopedFingerprint('agent','user@example.com',agentFields,{}),scopedFingerprint('student','user@example.com',agentFields,{}));
});

test('the server checks legacy contact-only keys and rejects stale or reused uploads',()=>{
 const submit=readFileSync(new URL('../../src/app/api/public/forms/[slug]/submit/route.ts',import.meta.url),'utf8');
 assert.match(submit,/legacyFingerprintId/);
 assert.match(submit,/oldSubmission=await tx\.get/);
 assert.match(submit,/oldScope===scope/);
 assert.match(submit,/new Set\(attachments\.map\(a=>a\.path\)\)/);
 assert.match(submit,/uploadAge>7\*24\*60\*60\*1000/);
});
test('public application links refresh instead of retaining stale forms forever',()=>{
 const links=readFileSync(new URL('../../src/components/PublicApplicationLinks.tsx',import.meta.url),'utf8');
 assert.match(links,/CACHE_MAX_AGE/);
 assert.match(links,/setInterval\(refresh/);
});
