import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync('src/lib/permissions.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(js,{exports},{timeout:3000});
const {can,canViewDashboard,safeDestination}=exports;

test('role permission matrix grants exactly the intended operations',()=>{
 for(const role of ['super_admin','admin','reviewer','finance','agent','student']){
  assert.equal(can(role,'profile.read'),true);
  assert.equal(can(role,'staff.manage'),role==='super_admin');
  assert.equal(can(role,'finance.manage'),['super_admin','admin','finance'].includes(role));
  assert.equal(can(role,'applications.review'),['super_admin','admin','reviewer'].includes(role));
  assert.equal(can(role,'applications.delete'),['super_admin','admin'].includes(role));
  assert.equal(can(role,'content.manage'),['super_admin','admin'].includes(role));
  assert.equal(can(role,'referrals.read'),['super_admin','admin','agent'].includes(role));
 }
 assert.equal(can(undefined,'staff.manage'),false);
 assert.equal(can('unknown','staff.manage'),false);
});
test('role page guards deny sensitive deep links and legitimate finance access is visible',()=>{
 assert.equal(canViewDashboard('agent','/dashboard/applications/new'),false);
 assert.equal(canViewDashboard('agent','/dashboard/referrals'),true);
 assert.equal(canViewDashboard('agent','/dashboard'),false);
 assert.equal(canViewDashboard('reviewer','/dashboard/staff'),false);
 assert.equal(canViewDashboard('finance','/dashboard/finance'),true);
 assert.equal(canViewDashboard('finance','/dashboard/staff'),false);
 assert.equal(canViewDashboard('student','/dashboard/applications'),false);
 assert.equal(canViewDashboard('admin','/dashboard/settings/acceptance-letter'),true);
 assert.equal(canViewDashboard('reviewer','/dashboard/settings/acceptance-letter'),false);
});
test('login redirect cannot target privileged, external or agent-only destinations',()=>{
 assert.equal(safeDestination('finance','/dashboard/staff'),'/dashboard/finance');
 assert.equal(safeDestination('agent','/dashboard/applications/new'),'/agent-portal');
 assert.equal(safeDestination('student','//evil.example'),'/student-portal');
 assert.equal(safeDestination('student','https://evil.example'),'/student-portal');
 assert.equal(safeDestination('reviewer','/dashboard/finance'),'/dashboard/finance');
 assert.equal(safeDestination('student','/student-portal/applications'),'/student-portal/applications');
});
test('bulk export requires application review rather than agent registry read',()=>{
 const route=readFileSync('src/app/api/admin/submissions/batch-download/route.ts','utf8');
 assert.match(route,/requirePermission\(req,'applications.review'\)/);
});
