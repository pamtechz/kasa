import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../../src/lib/application-experience.ts',import.meta.url),'utf8');
const exports={};new Function('exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports);
const {sectionIssue,visibleApplicationFields,applicationDraftKey,inputAutocomplete}=exports;
test('section validation ignores hidden requirements and catches empty or malformed visible answers',()=>{
 const fields=[{id:'email',label:'Email',type:'email',required:true},{id:'phone',label:'Phone',type:'tel',required:false},{id:'sponsor',label:'Sponsor',type:'text',required:true,condition:{fieldId:'funding',equals:'CDF'}}];
 assert.equal(visibleApplicationFields(fields,{funding:'Self funded'}).length,2);
 assert.equal(sectionIssue(fields,{email:'   '}).fieldId,'email');
 assert.equal(sectionIssue(fields,{email:'invalid'}).fieldId,'email');
 assert.equal(sectionIssue(fields,{email:'student@example.test',phone:'bad'}).fieldId,'phone');
 assert.equal(sectionIssue(fields,{email:'student@example.test',funding:'CDF'}).fieldId,'sponsor');
 assert.equal(sectionIssue(fields,{email:'student@example.test',phone:'+260971000000',funding:'Self funded'}),null);
});
test('only published choices can be submitted and drafts are isolated by form version',()=>{
 const field={id:'programme',label:'Programme',type:'select',required:true,options:['Agriculture']};
 assert.equal(sectionIssue([field],{programme:'Retired course'}).fieldId,'programme');
 assert.equal(sectionIssue([field],{programme:'Agriculture'}),null);
 assert.notEqual(applicationDraftKey({slug:'enroll',version:1}),applicationDraftKey({slug:'enroll',version:2}));
 assert.notEqual(applicationDraftKey({slug:'enroll',version:1}),applicationDraftKey({slug:'agent',version:1}));
 assert.equal(inputAutocomplete({type:'email'}),'email');assert.equal(inputAutocomplete({type:'text',id:'full-name',label:'Full name'}),'name');
});
test('public Apply action opens admissions instead of demanding sign-in',()=>{
 const nav=readFileSync(new URL('../../src/components/SiteChrome.tsx',import.meta.url),'utf8');
 assert.match(nav,/href="\/admissions#apply".*Apply Now/);
 const page=readFileSync(new URL('../../src/components/AdmissionsPage.tsx',import.meta.url),'utf8');
 assert.match(page,/Apply now/);assert.match(page,/Search programmes/);
 assert.doesNotMatch(page,/2027 Admissions|Six clear admission/i);
});
