import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readApprovedFeeQuote} from '../../src/lib/approved-fee-quote.ts';
const ok={status:'approved',programmeId:'crop-production',version:'2027-jan-1',currency:'ZMW',tuition:2600,practical:600,administration:150,accommodation:1000,food:2000,total:6350};
test('accept only versioned approved ZMW fee quotes with consistent breakdowns',()=>{
 assert.equal(readApprovedFeeQuote(ok)?.total,6350);
 for(const x of [null,{}, {...ok,status:'draft'}, {...ok,programmeId:''},{...ok,version:''},
  {...ok,total:8200},{...ok,total:'6350'},{...ok,food:-1},{...ok,tuition:NaN},{...ok,currency:'USD'}]){
  assert.equal(readApprovedFeeQuote(x),null);
 }
});
test('financial totals never guess tuition from user-entered labels or suggest fake receipts',()=>{
 const finance=readFileSync(new URL('../../src/app/api/admin/finance/route.ts',import.meta.url),'utf8');
 const screen=readFileSync(new URL('../../src/app/(portal)/dashboard/finance/page.tsx',import.meta.url),'utf8');
 assert.match(finance,/readApprovedFeeQuote\(x\.feeQuote\)/);
 assert.match(finance,/missingFeeQuotes/);
 assert.doesNotMatch(finance,/tuitionFee = 8200|programme\.includes\('K/);
 assert.match(screen,/Fee reconciliation required/);
 assert.doesNotMatch(screen,/: '1000'/);
 assert.match(screen,/can\(role,'finance.record'\)/);
 assert.match(screen,/item\.fundingMethod === 'cdf'/);
 assert.match(screen,/item\.outstandingBalance === 0/);
});
