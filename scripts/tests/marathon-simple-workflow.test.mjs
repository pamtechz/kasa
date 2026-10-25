import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {jsx,jsxs} from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {marathonFocusViews,marathonCategories,isMarathonCategorySection} from '../../src/lib/marathon-categories.ts';

const source=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const bindings={
 _jsx:jsx,_jsxs:jsxs,marathonFocusViews,marathonCategories,isMarathonCategorySection,
 useState:value=>[typeof value==='function'?value():value,()=>{}],
 statusLabels:{todo:'Not started',doing:'In progress',blocked:'Blocked',done:'Completed'},
 X:()=>null,Check:()=>null,Plus:()=>null,MessageSquarePlus:()=>null
};
globalThis.__marathonSimpleFixture=bindings;
async function compile(input){
 const compiled=ts.transpileModule(input,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^import .*?;\s*$/gm,'');
 const header='const {'+Object.keys(bindings).join(',')+'}=globalThis.__marathonSimpleFixture;\n';
 return import('data:text/javascript;base64,'+Buffer.from(header+compiled).toString('base64'));
}
const {MarathonQuickViews}=await compile(source('src/components/marathon/MarathonQuickViews.tsx'));
const parsed=ts.createSourceFile('MarathonWorkspace.tsx',source('src/components/marathon/MarathonWorkspace.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=new Set(['TaskDrawer','NewTaskModal','dateTimeLocal','formatDate','progressClass']);
const declarations=parsed.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.has(node.name?.text)).map(node=>node.getFullText(parsed)).join('\n');
const {TaskDrawer,NewTaskModal}=await compile(declarations+'\nexport {TaskDrawer,NewTaskModal};');
function find(node,predicate){
 if(!node||typeof node!=='object')return null;
 if(Array.isArray(node)){for(const child of node){const found=find(child,predicate);if(found)return found;}return null;}
 if(predicate(node))return node;
 return find(node.props?.children,predicate);
}
test('quick views render all five counts with an accessible selected state and correct action',()=>{
 let selected=null;
 const tree=MarathonQuickViews({focus:'open',counts:{all:12,open:10,attention:4,week:3,done:2},onChange:value=>{selected=value;}});
 const html=renderToStaticMarkup(tree);
 assert.equal((html.match(/<button\b/g)||[]).length,5);
 assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
 assert.ok(html.includes('Checklist quick views'));assert.ok(html.includes('Needs attention'));
 const attention=find(tree,node=>node.type==='button'&&node.props.children[0].props.children==='Needs attention');
 attention.props.onClick();assert.equal(selected,'attention');
});
const original={id:'T001',title:'Confirm route permit',lead:'KASA Team',dueDate:'2027-01-01',priority:'P1 Act now',importance:'Critical',status:'done',completedAt:null,nextStep:'Call the council',evidence:'Letter 101',notes:'Keep these notes',dependencies:['T002'],section:marathonCategories[2].section,archived:false};
test('collapsed task details retain priority, importance, evidence, notes and unknown completion dates on save',()=>{
 let saved=null;
 const tree=TaskDrawer({task:original,editable:true,saving:false,queued:false,onClose:()=>{},onRecommend:()=>{},onSave:value=>{saved=value;}});
 const more=find(tree,node=>node.type==='details');
 assert.equal(more.props.open,undefined);
 const form=find(tree,node=>node.type==='form'&&node.props.id==='ml-task-form');
 form.props.onSubmit({preventDefault:()=>{}});
 assert.equal(saved.priority,original.priority);assert.equal(saved.importance,original.importance);
 assert.equal(saved.notes,original.notes);assert.equal(saved.evidence,original.evidence);
 assert.equal(saved.section,original.section);assert.equal(saved.archived,false);
 assert.equal(Object.hasOwn(saved,'completedAt'),false);
 const html=renderToStaticMarkup(tree);
 assert.ok(html.includes('Marked Done in the source checklist'));
 assert.ok(html.indexOf('Category')<html.indexOf('More details and archive'));
});
test('archived records expand archive controls while viewers receive disabled fields',()=>{
 const editable=TaskDrawer({task:{...original,archived:true},editable:true,saving:false,queued:false,onClose:()=>{},onRecommend:()=>{},onSave:()=>{}});
 assert.equal(find(editable,node=>node.type==='details').props.open,true);
 const viewer=TaskDrawer({task:original,editable:false,saving:false,queued:false,onClose:()=>{},onRecommend:()=>{},onSave:()=>{}});
 assert.equal(find(viewer,node=>node.type==='select'&&node.props.value===original.section).props.disabled,true);
 assert.equal(find(viewer,node=>node.type==='input'&&node.props.type==='checkbox'),null);
});
test('new actions retain their category and optional defaults when optional details remain closed',()=>{
 let saved=null;
 const tree=NewTaskModal({saving:false,initialSection:marathonCategories[4].section,onClose:()=>{},onSave:value=>{saved=value;}});
 assert.equal(find(tree,node=>node.type==='details').props.open,undefined);
 find(tree,node=>node.type==='form').props.onSubmit({preventDefault:()=>{}});
 assert.equal(saved.section,marathonCategories[4].section);assert.equal(saved.priority,'P2 Next 30 days');
 assert.equal(saved.importance,'High');assert.equal(saved.notes,'');
});
