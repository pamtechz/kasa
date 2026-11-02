import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEGACY_MARATHON_EVENT_ID,legacyMarathonEvent,taskEventId,dateWithinEvent,calculatedLineMinor,budgetTotals} from '../../src/lib/marathon-event-model.ts';
import {marathon2027BudgetDraft,marathon2027BudgetDraftTotalMinor} from '../../src/data/marathon-2027-budget.ts';

test('existing untagged tasks always belong to the March 2027 event',()=>{
 assert.equal(taskEventId({}),LEGACY_MARATHON_EVENT_ID);
 assert.equal(taskEventId({eventId:'ev-independent'}),'ev-independent');
 assert.equal(taskEventId({eventId:''}),LEGACY_MARATHON_EVENT_ID);
});
test('event preparations and closeout time frame validates task and budget dates',()=>{
 assert.equal(dateWithinEvent('2026-11-01',legacyMarathonEvent),true);
 assert.equal(dateWithinEvent('2027-03-21',legacyMarathonEvent),true);
 assert.equal(dateWithinEvent('2027-04-21',legacyMarathonEvent),true);
 assert.equal(dateWithinEvent('2027-04-22',legacyMarathonEvent),false);
 assert.equal(dateWithinEvent('2026-10-31',legacyMarathonEvent),false);
});
test('money arithmetic retains exact ngwee and monthly planning multipliers',()=>{
 assert.equal(calculatedLineMinor(1,313754,1),313754);
 assert.equal(calculatedLineMinor(5,25000,1),125000);
 assert.equal(calculatedLineMinor(5,50000,1),250000);
 assert.throws(()=>calculatedLineMinor(Number.MAX_SAFE_INTEGER,100,2));
});
test('approved draft 80 detailed lines reconcile to the source worksheet',()=>{
 assert.equal(marathon2027BudgetDraft.length,80);
 const total=marathon2027BudgetDraft.reduce((sum,item)=>sum+calculatedLineMinor(item.quantity,item.unitCostMinor,item.months),0);
 assert.equal(total,marathon2027BudgetDraftTotalMinor);
 assert.equal(total,561438754);
 const projected=budgetTotals(marathon2027BudgetDraft.map(item=>({
  plannedMinor:calculatedLineMinor(item.quantity,item.unitCostMinor,item.months),actualPaidMinor:0,status:'draft'
 })),6000,45000);
 assert.equal(projected.projectedRegistrationMinor,270000000);
 assert.equal(projected.plannedMinor,561438754);
 assert.equal(Math.round(projected.plannedMinor/10),56143875);
 assert.equal(projected.plannedMinor+Math.round(projected.plannedMinor/10),617582629);
});
test('source code keeps budget and task creation on audited authenticated server APIs',()=>{
 const base=new URL('../../src/app/api/marathon/',import.meta.url);
 const events=readFileSync(new URL('events/route.ts',base),'utf8');
 const budgets=readFileSync(new URL('events/[id]/budget/route.ts',base),'utf8');
 const update=readFileSync(new URL('events/[id]/budget/[lineId]/route.ts',base),'utf8');
 const tasks=readFileSync(new URL('tasks/route.ts',base),'utf8');
 for(const file of [events,budgets,update,tasks]){
  assert.match(file,/marathonIdentity\(req\)/);
  assert.match(file,/sameOrigin\(req\)/);
  assert.match(file,/marathonAudit/);
 }
 assert.match(budgets,/requireBudgetAccess/);
 assert.match(update,/expectedRevision/);
 assert.match(tasks,/requireEventTaskEdit/);
});
