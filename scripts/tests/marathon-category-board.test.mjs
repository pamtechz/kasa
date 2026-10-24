import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {jsx,jsxs} from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {groupMarathonCategories,marathonCategories} from '../../src/lib/marathon-categories.ts';

const seed=JSON.parse(readFileSync(new URL('../../src/data/marathon-seed.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../../src/components/marathon/MarathonCategoryBoard.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^import .*?;\s*$/gm,'');
globalThis.__marathonCategoryBoard={_jsx:jsx,_jsxs:jsxs,Link:props=>createElement('a',props),ArrowUpRight:()=>null,Layers3:()=>null,groupMarathonCategories};
const header='const {_jsx,_jsxs,Link,ArrowUpRight,Layers3,groupMarathonCategories}=globalThis.__marathonCategoryBoard;\n';
const {MarathonCategoryBoard}=await import('data:text/javascript;base64,'+Buffer.from(header+compiled).toString('base64'));

test('category cards render all source workstreams, accessible progress and working filter destinations',()=>{
 const html=renderToStaticMarkup(createElement(MarathonCategoryBoard,{tasks:seed.items}));
 assert.equal((html.match(/<a\b/g)||[]).length,15);
 assert.equal((html.match(/<progress\b/g)||[]).length,15);
 for(const group of groupMarathonCategories(seed.items)){
  assert.ok(html.includes('href="/marthon/operations?category='+group.category.id+'"'));
  assert.ok(html.includes('value="'+group.completed+'" max="'+group.tasks.length+'"'));
 }
 assert.ok(html.includes('8 actions'));
 assert.ok(!html.includes('Needs a category'));
 assert.ok(html.indexOf('category=planning')<html.indexOf('category=sponsorship'));
 assert.equal(marathonCategories.length,15);
});
test('category cards retain a visible destination for legacy unassigned work and exclude archives',()=>{
 const tasks=[{...seed.items[0],archived:true},{...seed.items[1],section:undefined,id:'M-uncategorized'}];
 const html=renderToStaticMarkup(createElement(MarathonCategoryBoard,{tasks}));
 assert.equal((html.match(/<a\b/g)||[]).length,16);
 assert.ok(html.includes('href="/marthon/operations?category=uncategorized"'));
 assert.ok(html.includes('Needs a category'));
 assert.ok(html.includes('1 action'));
 assert.ok(html.includes('0 actions'));
});
