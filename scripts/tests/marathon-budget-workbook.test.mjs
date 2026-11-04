import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetLineAmounts,budgetCategories,budgetReview,budgetCsv,lineClassification} from '../../src/lib/marathon-budget-workbook.ts';
const line=(id,values={})=>({id,category:'Equipment',description:'Tables',quantity:2,unitCostMinor:50000,months:1,plannedMinor:100000,actualPaidMinor:10000,status:'draft',notes:'',...values});
test('new quoted items enter totals only after selecting Costed',()=>{
 for(const treatment of ['tbc','in_kind','within_allocation','outside_consolidated','free','waived'])
  assert.deepEqual(budgetLineAmounts(2,50000,1,treatment),{plannedMinor:0,reportedEstimateMinor:100000});
 assert.deepEqual(budgetLineAmounts(2,50000,1,'costed'),{plannedMinor:100000,reportedEstimateMinor:100000});
 assert.throws(()=>budgetLineAmounts(Number.MAX_SAFE_INTEGER,2,2,'costed'));
});
test('category totals omit voided allocations and preserve signed remaining amounts',()=>{
 const totals=budgetCategories([line('a'),line('b',{status:'void'}),line('c',{category:'New category',plannedMinor:0,actualPaidMinor:0})]);
 assert.equal(totals[0].planned,100000);assert.equal(totals[0].paid,10000);assert.equal(totals[1].category,'New category');
});
test('explicit edited treatment overrides imported treatment without deleting provenance',()=>{
 assert.equal(lineClassification({sourceClassification:'tbc',classification:'costed'}),'costed');
 const result=budgetReview([line('a',{sourceClassification:'outside_consolidated',reportedEstimateMinor:1700000}),line('b',{sourceClassification:'tbc'}),line('c',{sourceClassification:'in_kind'}),line('d',{sourceClassification:'tbc',status:'void'})]);
 assert.equal(result.outsideMinor,1700000);assert.equal(result.unpriced.length,1);assert.equal(result.partners.length,1);
});
test('Excel CSV preserves funding, source estimates and reported claims, escaping formulas',()=>{
 const csv=budgetCsv([line('a',{description:'=HYPERLINK("bad")',sourceOfFunds:'Sponsor, one',sourceClassification:'outside_consolidated',reportedEstimateMinor:400000,reportedPaidClaimMinor:1230000,dueDateText:'Before launch'})]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
 assert.ok(csv.includes('"Sponsor, one"'));assert.ok(csv.includes('"4000"'));assert.ok(csv.includes('"12300"'));assert.ok(csv.includes('Before launch'));
});
