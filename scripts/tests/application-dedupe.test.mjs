import test from 'node:test';
import assert from 'node:assert/strict';
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
