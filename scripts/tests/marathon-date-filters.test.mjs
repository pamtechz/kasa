import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checklistDateError,matchesChecklistDueDate,sortChecklistTasks} from '../../src/lib/marathon-date-filters.ts';
import {matchesMarathonFilters} from '../../src/lib/marathon-categories.ts';

const none={mode:'all',year:'2026',month:'2026-10',from:'',to:''};
const task=(id,dueDate,priority='P2 Next 30 days')=>({
 id,dueDate,priority,section:'1. EVENT PLANNING, GOVERNANCE & APPROVALS',
 title:'Arrange permit',lead:'Team',status:'todo',nextStep:'Confirm venue',archived:false
});

test('month and year filters use the complete calendar window and exclude undated tasks',()=>{
 const dates=['2026-09-30','2026-10-01','2026-10-31','2026-11-01','2027-10-15',null,'2026-02-30'];
 const month={...none,mode:'month',month:'2026-10'};
 const year={...none,mode:'year',year:'2026'};
 assert.deepEqual(dates.map(dueDate=>matchesChecklistDueDate({dueDate},month)),[false,true,true,false,false,false,false]);
 assert.deepEqual(dates.map(dueDate=>matchesChecklistDueDate({dueDate},year)),[true,true,true,true,false,false,false]);
 assert.equal(checklistDateError({...month,month:'2026-13'}),'Choose a valid month.');
 assert.equal(checklistDateError({...year,year:'26'}),'Enter a four-digit year.');
});

test('custom dates include both boundaries, accept one-sided windows and leap days',()=>{
 const range={...none,mode:'range',from:'2024-02-29',to:'2024-03-01'};
 for(const dueDate of ['2024-02-29','2024-03-01'])assert.equal(matchesChecklistDueDate({dueDate},range),true);
 for(const dueDate of ['2024-02-28','2024-03-02',null])assert.equal(matchesChecklistDueDate({dueDate},range),false);
 assert.equal(matchesChecklistDueDate({dueDate:'2024-04-01'},{...range,to:''}),true);
 assert.equal(matchesChecklistDueDate({dueDate:'2024-02-28'},{...range,from:''}),true);
 assert.equal(checklistDateError({...range,from:'2024-03-02'}),'Start date must be on or before end date.');
 assert.equal(checklistDateError({...range,from:'2025-02-29'}),'Enter valid calendar dates.');
 assert.equal(checklistDateError({...range,from:'',to:''}),'Choose at least a start or an end date.');
 assert.equal(matchesChecklistDueDate({dueDate:'2024-03-01'},{...range,from:'2024-03-02'}),false);
 assert.equal(matchesChecklistDueDate({dueDate:null},none),true);
});

test('chronological sorting is global, deterministic and does not mutate the source',()=>{
 const source=[task('D',null,'P1 Act now'),task('C','2026-11-01'),task('B','2026-10-01','P1 Act now'),task('A','2026-10-01','P2 Next 30 days'),task('E','2026-10-01','P2 Next 30 days'),task('X','bad-date')];
 const snapshot=source.map(t=>t.id);
 assert.deepEqual(sortChecklistTasks(source,'due-asc').map(t=>t.id),['B','A','E','C','D','X']);
 assert.deepEqual(sortChecklistTasks(source,'due-desc').map(t=>t.id),['C','B','A','E','D','X']);
 assert.deepEqual(sortChecklistTasks(source,'priority').map(t=>t.id),['B','D','A','E','C','X']);
 assert.deepEqual(source.map(t=>t.id),snapshot);
});

test('date selection composes with existing category, status and urgency filters',()=>{
 const list=[task('T001','2026-10-29','P1 Act now'),task('T002','2026-11-01','P1 Act now'),task('T003',null,'P1 Act now'),{...task('T004','2026-10-30','P1 Act now'),status:'done'}, {...task('T005','2026-10-30','P1 Act now'),archived:true}];
 const period={...none,mode:'month',month:'2026-10'};
 const matched=list.filter(t=>matchesChecklistDueDate(t,period)&&matchesMarathonFilters(t,{status:'todo',priority:'P1',category:'planning',focus:'attention',today:'2026-10-29'}));
 assert.deepEqual(matched.map(t=>t.id),['T001']);
});

test('checklist controls are wired into the actual workspace and existing view resets',()=>{
 const workspace=readFileSync(new URL('../../src/components/marathon/MarathonWorkspace.tsx',import.meta.url),'utf8');
 const controls=readFileSync(new URL('../../src/components/marathon/MarathonDateControls.tsx',import.meta.url),'utf8');
 assert.match(workspace,/MarathonDateControls/);
 assert.match(workspace,/matchesChecklistDueDate\(t,dateFilters\)/);
 assert.match(workspace,/sortChecklistTasks\(/);
 assert.match(workspace,/sortOrder!=='priority'/);
 assert.match(workspace,/setDateFilters\(defaultDateFilters\(\)\)/);
 assert.match(controls,/aria-label="Sort checklist"/);
 assert.match(controls,/aria-label="Filter by due-date period"/);
 assert.match(controls,/aria-label="Checklist from date"/);
 assert.match(controls,/aria-label="Checklist to date"/);
 assert.match(controls,/role="alert"/);
});
