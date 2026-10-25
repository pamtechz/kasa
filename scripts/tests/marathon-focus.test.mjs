import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {marathonCategories,marathonToday,matchesMarathonFocus,marathonFocusCounts,matchesMarathonFilters} from '../../src/lib/marathon-categories.ts';
const today='2026-10-25';
const task=(id,changes={})=>({id,title:'Confirm route permit',lead:'KASA Team',dueDate:null,priority:'P2 Next 30 days',urgency:'Scheduled',importance:'High',status:'todo',dependencies:[],nextStep:'Call the council',completedAt:null,revision:1,updatedAt:'2026-10-25T08:00:00Z',updatedBy:'editor',section:marathonCategories[2].section,...changes});
const tasks=[
 task('T001',{priority:'P1 Act now'}),
 task('T002',{status:'blocked',dueDate:'2027-01-01'}),
 task('T003',{dueDate:'2026-10-24'}),
 task('T004',{dueDate:today}),
 task('T005',{status:'done',priority:'P1 Act now',dueDate:'2026-10-20'}),
 task('T006',{archived:true,priority:'P1 Act now'}),
 task('T007',{status:'doing',dueDate:'2026-10-31'}),
 task('T008',{dueDate:'2026-11-01'})
];
test('attention collects urgent, blocked and overdue work while excluding completion and archives',()=>{
 assert.deepEqual(tasks.filter(t=>matchesMarathonFocus(t,'attention',today)).map(t=>t.id),['T001','T002','T003']);
 assert.deepEqual(marathonFocusCounts(tasks,today),{all:7,open:6,attention:3,week:2,done:1});
});
test('next seven days includes today and six following days across calendar months',()=>{
 const due=['2026-10-24','2026-10-25','2026-10-31','2026-11-01',null];
 assert.deepEqual(due.map(dueDate=>matchesMarathonFocus(task('T001',{dueDate}),'week',today)),[false,true,true,false,false]);
 assert.equal(matchesMarathonFocus(task('T001',{dueDate:today,status:'done'}),'week',today),false);
 assert.equal(matchesMarathonFocus(task('T001',{dueDate:today,archived:true}),'week',today),false);
});
test('deadline comparisons use the Lusaka calendar date at the UTC midnight boundary',()=>{
 assert.equal(marathonToday(new Date('2026-10-25T21:59:59Z')),'2026-10-25');
 assert.equal(marathonToday(new Date('2026-10-25T22:00:00Z')),'2026-10-26');
 assert.equal(marathonToday(new Date('2026-12-31T22:30:00Z')),'2027-01-01');
});
test('quick views combine with category, search, owner, priority and detailed status filters',()=>{
 const filters={category:'routes',focus:'attention',today,status:'todo',priority:'P1',lead:'KASA Team',query:' T001 '};
 assert.deepEqual(tasks.filter(t=>matchesMarathonFilters(t,filters)).map(t=>t.id),['T001']);
 assert.equal(matchesMarathonFilters(tasks[0],{...filters,category:'planning'}),false);
 assert.equal(matchesMarathonFilters(tasks[0],{...filters,focus:'done'}),false);
 assert.equal(matchesMarathonFilters({...tasks[0],archived:true},filters),false);
});
test('quick-view totals retain all 186 source actions and five source-reported completions',()=>{
 const seed=JSON.parse(readFileSync(new URL('../../src/data/marathon-seed.json',import.meta.url),'utf8'));
 const counts=marathonFocusCounts(seed.items,today);
 assert.equal(counts.all,186);assert.equal(counts.open,181);assert.equal(counts.done,5);
 assert.equal(counts.open+counts.done,counts.all);
 assert.deepEqual(marathonFocusCounts([],today),{all:0,open:0,attention:0,week:0,done:0});
});
