import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {marathonCategories,categoryForSection,groupMarathonCategories,matchesMarathonFilters,isMarathonCategorySection} from '../../src/lib/marathon-categories.ts';
import {preserveSourceCategory} from '../../src/lib/marathon-task-update.ts';
import {planChecklistImport} from '../../src/lib/marathon-seed-import.ts';
const seed=JSON.parse(readFileSync(new URL('../../src/data/marathon-seed.json',import.meta.url),'utf8'));
const legacy=JSON.parse(readFileSync(new URL('../../src/data/marathon-seed-2026-10-23.json',import.meta.url),'utf8'));
const tasks=seed.items.map(t=>({...t,revision:1,archived:false,updatedAt:'2026-10-24T18:00:00Z',updatedBy:'import'}));

test('every one of the 186 source actions belongs to exactly one of the 15 document categories',()=>{
 assert.deepEqual(marathonCategories.map(c=>c.section),seed.sections);
 assert.equal(new Set(marathonCategories.map(c=>c.id)).size,15);
 const groups=groupMarathonCategories(tasks);
 assert.deepEqual(groups.map(g=>g.tasks.length),[8,11,15,12,15,10,15,12,16,12,12,17,13,7,11]);
 assert.equal(new Set(groups.flatMap(g=>g.tasks.map(t=>t.id))).size,186);
 assert.equal(groups.reduce((n,g)=>n+g.completed,0),5);
 assert.ok(groups.every(g=>g.category.id!=='uncategorized'));
});
test('a source task with a missing or unrecognised category is rejected before any import',()=>{
 for(const section of [undefined,'Unknown category']){
  const invalid=structuredClone(seed);invalid.items[0].section=section;
  assert.throws(()=>planChecklistImport(invalid,legacy,[],null,'super','2026-10-24T18:00:00Z'),e=>e.status===500);
 }
});
test('category, status, priority, owner and search filters combine without including archived work',()=>{
 const task=tasks.find(t=>t.id==='T025');
 const filters={category:'routes',status:task.status,priority:task.priority.slice(0,2),lead:task.lead,query:' '+task.id+' '};
 assert.deepEqual(tasks.filter(t=>matchesMarathonFilters(t,filters)).map(t=>t.id),[task.id]);
 assert.equal(matchesMarathonFilters(task,{...filters,category:'planning'}),false);
 assert.equal(matchesMarathonFilters(task,{...filters,lead:'Unknown team'}),false);
 assert.equal(matchesMarathonFilters({...task,archived:true},filters),false);
 assert.equal(tasks.filter(t=>matchesMarathonFilters(t,{category:'safety'})).length,15);
});
test('legacy actions without a category stay visible in a distinct group and do not disappear',()=>{
 const unknown={...tasks[0],id:'M-legacy',section:undefined};
 const groups=groupMarathonCategories([tasks[0],unknown,{...tasks[1],archived:true}]);
 assert.equal(groups.length,2);assert.equal(groups[1].category.id,'uncategorized');assert.equal(groups[1].tasks[0].id,'M-legacy');
 assert.equal(categoryForSection('unknown').id,'uncategorized');
 assert.equal(isMarathonCategorySection(''),false);
 assert.equal(groupMarathonCategories([],true).length,15);
});
test('manual categories survive a later document revision, including records from the earlier snapshot format',()=>{
 const now='2026-10-24T18:00:00Z';
 const records=planChecklistImport(seed,legacy,[],null,'super',now).changes.map(c=>c.after);
 const task=records.find(t=>t.id==='T001');
 delete task.sourceSnapshot.section;
 const from=task.section,to=marathonCategories[12].section;
 Object.assign(task,preserveSourceCategory(task,{section:to}),{section:to,revision:2});
 assert.equal(task.sourceSnapshot.section,from);
 const next=structuredClone(seed);next.version='next-categorized-source';next.items.find(t=>t.id==='T001').section=marathonCategories[6].section;
 const plan=planChecklistImport(next,legacy,records,{version:seed.version},'super',now);
 assert.equal(plan.changes.find(c=>c.id==='T001').after.section,to);
 assert.ok(plan.preservedFields.find(t=>t.id==='T001').fields.includes('section'));
});
