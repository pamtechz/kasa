import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const exports={};new Function('exports',ts.transpileModule(readFileSync(new URL('../../src/lib/form-upload-presentation.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports);
test('saved Cloudinary form instructions become device pickers while preserving IDs, requirements and NRC reporting alternative',()=>{
 const field={id:'identity-document-url',label:'Applicant photograph (strictly from https://console.cloudinary.com/app)',type:'image',required:false,description:'Optional scanned NRC from https://console.cloudinary.com/app. You can also present original NRC upon reporting.'};
 const form={version:3,sections:[{id:'documents',fields:[field]}]};
 const normalized=exports.presentFormUploads(form),result=normalized.sections[0].fields[0];
 assert.equal(result.id,field.id);assert.equal(result.required,false);assert.equal(normalized.version,3);
 assert.doesNotMatch(JSON.stringify(result),/cloudinary/i);assert.equal(result.label,'Applicant photograph');
 assert.match(result.description,/Optional/);assert.match(result.description,/present original NRC upon reporting/);
 assert.match(result.description,/external storage/);assert.equal(form.sections[0].fields[0],field);assert.match(field.label,/cloudinary/);
});
test('unrelated custom wording and non-upload fields remain unchanged',()=>{
 const field={id:'email',type:'email',label:'Email address',description:'Your own email'};
 assert.equal(exports.presentUploadField(field),field);
 const custom={id:'image',type:'image',label:'Identity image',description:'Bring originals for verification.'};
 assert.equal(exports.presentUploadField(custom),custom);
});
