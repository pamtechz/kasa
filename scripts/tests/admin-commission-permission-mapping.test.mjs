import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeCapability,can} from '../../src/lib/permissions.ts';

test('Admin commission-settings GET and PATCH resolve to explicit safe capabilities',()=>{
 assert.equal(routeCapability('/api/admin/settings/commissions','GET'),'commissions.read');
 assert.equal(routeCapability('/api/admin/settings/commissions','PATCH'),'commissions.manage');
 for(const role of ['super_admin','admin']){
  assert.equal(can(role,'commissions.read'),true);
  assert.equal(can(role,'commissions.manage'),true);
 }
 assert.equal(can('reviewer','commissions.read'),true);
 assert.equal(can('reviewer','commissions.manage'),false);
 assert.equal(can('finance','commissions.manage'),false);
 assert.equal(can('agent','commissions.manage'),false);
});

test('Finance reconciliation and verified payout advance actions are mapped explicitly',()=>{
 assert.equal(routeCapability('/api/admin/finance/reconciliation','GET'),'finance.read');
 assert.equal(routeCapability('/api/admin/commissions/advance','GET'),'commissions.read');
 assert.equal(routeCapability('/api/admin/commissions/advance','POST'),'commissions.manage');
 assert.equal(routeCapability('/api/admin/finance','POST'),'finance.record');
 assert.equal(can('super_admin','finance.read'),true);
 assert.equal(can('admin','finance.read'),true);
});

test('Unexpected methods and unrecognized routes continue to fail closed',()=>{
 for(const [url,method] of [
  ['/api/admin/settings/commissions','DELETE'],['/api/admin/settings/commissions','POST'],
  ['/api/admin/finance/reconciliation','POST'],['/api/admin/commissions/advance','DELETE'],
  ['/api/admin/commissions/advance','PATCH'],['/api/admin/not-a-route','GET'],
  ['/api/admin/finance','DELETE']])
  assert.equal(routeCapability(url,method),null,method+' '+url+' must not be allowed');
});

test('A reviewer cannot write to commission policy even if the endpoint permits GET',()=>{
 assert.equal(can('reviewer',routeCapability('/api/admin/settings/commissions','GET')),true);
 assert.equal(can('reviewer',routeCapability('/api/admin/settings/commissions','PATCH')),false);
});
