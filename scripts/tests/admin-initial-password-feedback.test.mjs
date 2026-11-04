import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../../src/lib/initial-password-policy.ts';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('password action explains missing inputs and requires matching credentials and confirmation',()=>{
 assert.match(policy.initialPasswordIssue('','',false),/Enter an initial password/);
 assert.match(policy.initialPasswordIssue('Ab1!cd','different',true),/same initial password/);
 assert.match(policy.initialPasswordIssue('Ab1!cd','Ab1!cd',false),/confirmation box/);
 assert.equal(policy.initialPasswordIssue('Ab1!cd','Ab1!cd',true),'');
 assert.ok(policy.initialPasswordIssue('short','short',true));
});
test('unverified target account can receive a password without changing email ownership or exposing the password',async()=>{
 const updates=[],authUpdates=[],revoked=[],audits=[];
 const profile={role:'marathon_only',active:true,email:'member@example.test'};
 const db={collection(name){assert.equal(name,'profiles');return {doc(uid){assert.equal(uid,'target');return {async get(){return {exists:true,data:()=>profile};},async update(v){updates.push(v);}};}};}};
 const adminAuth={async getUser(){return {email:'member@example.test',emailVerified:false,disabled:false};},async updateUser(uid,v){authUpdates.push({uid,...v});},async revokeRefreshTokens(uid){revoked.push(uid);}};
 class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
 const exports={};
 const context={exports,require(path){
  if(path==='server-only')return {};
  if(path==='@/lib/firebase-admin')return {db,adminAuth};
  if(path==='@/lib/security')return {audit:async(...args)=>audits.push(args)};
  if(path==='@/lib/errors')return {HttpError};
  if(path==='@/lib/initial-password-policy')return policy;
  throw Error('Unexpected import '+path);
 }};
 const code=ts.transpileModule(read('src/lib/admin-initial-password.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,context);
 const result=await exports.setInitialPassword('target','owner','Ab1!cd');
 assert.equal(authUpdates[0].uid,'target');assert.equal(authUpdates[0].password,'Ab1!cd');
 assert.equal(Object.hasOwn(authUpdates[0],'emailVerified'),false);
 assert.equal(updates[0].mustChangePassword,true);assert.equal(typeof updates[0].adminPasswordProvisionedAt,'string');
 assert.equal(revoked[0],'target');assert.equal(result.emailVerificationRequired,true);
 assert.equal(JSON.stringify(updates).includes('Ab1!cd'),false);assert.equal(JSON.stringify(result).includes('Ab1!cd'),false);
 assert.equal(audits[0][3].unverified,true);
 profile.role='super_admin';await assert.rejects(exports.setInitialPassword('target','owner','Ab1!cd'),/super administrator/);
 await assert.rejects(exports.setInitialPassword('owner','owner','Ab1!cd'),/your own password/);
});
test('both editors leave an active account action available even before verification',()=>{
 for(const p of ['src/app/marathon/settings/members/[uid]/page.tsx','src/app/(portal)/dashboard/staff/[uid]/edit/page.tsx']){
  const s=read(p);assert.match(s,/initialPasswordIssue\(/);assert.match(s,/Email verification may be pending/);
  assert.doesNotMatch(s,/disabled=\{[^}]*isValidInitialPassword/);
  assert.doesNotMatch(s,/disabled=\{[^}]*emailVerified/);
 }
});
