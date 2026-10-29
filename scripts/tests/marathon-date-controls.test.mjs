import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement,Fragment} from 'react';
import {jsx,jsxs} from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {checklistDateError} from '../../src/lib/marathon-date-filters.ts';

const source=readFileSync(new URL('../../src/components/marathon/MarathonDateControls.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^import .*?;\s*$/gm,'');
globalThis.__marathonDateControls={_jsx:jsx,_jsxs:jsxs,_Fragment:Fragment,checklistDateError};
const prefix='const {_jsx,_jsxs,_Fragment,checklistDateError}=globalThis.__marathonDateControls;\n';
const {MarathonDateControls}=await import('data:text/javascript;base64,'+Buffer.from(prefix+compiled).toString('base64'));
const defaultFilters={mode:'all',year:'2026',month:'2026-10',from:'',to:''};
function render(filters=defaultFilters,sort='priority'){
 return renderToStaticMarkup(createElement(MarathonDateControls,{filters,sort,onSortChange:()=>{},onFiltersChange:()=>{}}));
}
function find(node,predicate){
 if(!node||typeof node!=='object')return null;
 if(Array.isArray(node)){for(const value of node){const result=find(value,predicate);if(result)return result;}return null;}
 if(predicate(node))return node;
 return find(node.props?.children,predicate);
}
test('date toolbar offers chronological sorts and calendar period selection without a form submission',()=>{
 const html=render();
 assert.match(html,/Checklist due-date filters and sorting/);
 assert.match(html,/Priority, then due date/);
 assert.match(html,/Due date: earliest first/);
 assert.match(html,/Due date: latest first/);
 assert.match(html,/Custom date range/);
 assert.doesNotMatch(html,/Checklist from date/);
 assert.doesNotMatch(html,/role="alert"/);
});
test('each date mode renders accessible calendar inputs and errors',()=>{
 assert.match(render({...defaultFilters,mode:'month'}),/type="month".*aria-label="Checklist month"/);
 assert.match(render({...defaultFilters,mode:'year'}),/type="number".*aria-label="Checklist year"/);
 const html=render({...defaultFilters,mode:'range',from:'2026-12-01',to:'2026-11-01'},'due-asc');
 assert.match(html,/aria-label="Checklist from date"/);
 assert.match(html,/aria-label="Checklist to date"/);
 assert.match(html,/role="alert"/);
 assert.match(html,/Start date must be on or before end date/);
});
test('sort and date changes dispatch controlled values without mutating the existing filter',()=>{
 const events=[];
 const tree=MarathonDateControls({
  filters:defaultFilters,sort:'priority',
  onSortChange:value=>events.push(['sort',value]),
  onFiltersChange:value=>events.push(['filter',value])
 });
 find(tree,node=>node.type==='select'&&node.props['aria-label']==='Sort checklist').props.onChange({target:{value:'due-desc'}});
 find(tree,node=>node.type==='select'&&node.props['aria-label']==='Filter by due-date period').props.onChange({target:{value:'year'}});
 assert.deepEqual(events,[['sort','due-desc'],['filter',{...defaultFilters,mode:'year'}]]);
 assert.equal(defaultFilters.mode,'all');
});
