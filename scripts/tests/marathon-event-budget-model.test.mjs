import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEGACY_MARATHON_EVENT_ID,legacyMarathonEvent,taskEventId,dateWithinEvent,isMarathonCalendarDate,calculatedLineMinor,canTransitionBudgetStatus,budgetTotals} from '../../src/lib/marathon-event-model.ts';
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

test('budget state machine prevents approval bypass and post-payment voiding',()=>{
 assert.equal(canTransitionBudgetStatus('draft','paid'),false);
 assert.equal(canTransitionBudgetStatus('draft','submitted'),true);
 assert.equal(canTransitionBudgetStatus('submitted','approved'),true);
 assert.equal(canTransitionBudgetStatus('submitted','committed'),false);
 assert.equal(canTransitionBudgetStatus('approved','committed'),true);
 assert.equal(canTransitionBudgetStatus('committed','paid'),true);
 assert.equal(canTransitionBudgetStatus('paid','draft'),false);
 assert.equal(canTransitionBudgetStatus('paid','void'),false);
 assert.equal(canTransitionBudgetStatus('void','draft'),true);
});
test('budget route enforces an approver-only workflow and approved content lock',()=>{
 const route=readFileSync(new URL('../../src/app/api/marathon/events/[id]/budget/[lineId]/route.ts',import.meta.url),'utf8');
 assert.match(route,/data\.changes\.actualPaidMinor!==undefined\)requireBudgetAccess\(actor,event,'approve'\)/);
 assert.match(route,/canTransitionBudgetStatus\(previous\.status,data\.changes\.status\)/);
 assert.match(route,/Approved budget details are locked/);
 assert.match(route,/next\.actualPaidMinor>next\.plannedMinor/);
 assert.match(route,/if\(data\.changes\.status==='draft'\)/);
});

test('task assignment and confirmation are event-scoped and closed events are immutable',()=>{
 const assignment=readFileSync(new URL('../../src/app/api/marathon/tasks/[id]/assignees/route.ts',import.meta.url),'utf8');
 const confirmation=readFileSync(new URL('../../src/app/api/marathon/tasks/[id]/confirmation/route.ts',import.meta.url),'utf8');
 assert.match(assignment,/requireEventTaskEdit\(actor,event\)/);
 assert.match(assignment,/This event is closed to task assignment changes/);
 assert.match(confirmation,/This event is closed to task confirmations/);
 assert.match(assignment,/eventId:taskEventId\(before\)/);
 assert.match(confirmation,/eventId:taskEventId\(prior\)/);
});
test('activity endpoint prevents global financial audit disclosure',()=>{
 const activity=readFileSync(new URL('../../src/app/api/marathon/activity/route.ts',import.meta.url),'utf8');
 const workspace=readFileSync(new URL('../../src/components/marathon/MarathonWorkspace.tsx',import.meta.url),'utf8');
 assert.match(activity,/requireBudgetAccess\(identity,event,'read'\)/);
 assert.match(activity,/selectedEvent&&recordEvent!==selectedEvent.id/);
 assert.match(workspace,/\/api\/marathon\/activity\?event=/);
});

test('recommendation creation, review, pagination and bootstrap stay in the selected event',()=>{
 const base=new URL('../../src/app/api/marathon/',import.meta.url);
 const create=readFileSync(new URL('suggestions/route.ts',base),'utf8');
 const review=readFileSync(new URL('suggestions/[id]/route.ts',base),'utf8');
 const paging=readFileSync(new URL('../../src/lib/marathon-suggestions.ts',import.meta.url),'utf8');
 const bootstrap=readFileSync(new URL('bootstrap/route.ts',base),'utf8');
 assert.match(create,/eventId=taskEventId\(task.data\(\)\|\|\{\}\)/);
 assert.match(create,/marathonSuggestionsPage\(actor,query.get/);
 assert.match(review,/requireEventTaskReview\(actor,event\)/);
 assert.match(paging,/taskEventId\(record\)===eventId/);
 assert.match(bootstrap,/marathonSuggestionsPage\(identity,'pending',null,eventId\)/);
});

test('rejects impossible event dates and preserves valid leap-day schedules',()=>{
 assert.equal(isMarathonCalendarDate('2028-02-29'),true);
 assert.equal(isMarathonCalendarDate('2027-02-29'),false);
 assert.equal(isMarathonCalendarDate('2027-04-31'),false);
 assert.equal(isMarathonCalendarDate('2027-03-21'),true);
 assert.equal(dateWithinEvent('2027-02-29',legacyMarathonEvent),false);
});
