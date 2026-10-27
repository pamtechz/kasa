import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {jsx} from 'react/jsx-runtime';
import ts from 'typescript';
import {isMarathonWorkspacePath} from '../../src/lib/marathon-navigation.ts';

const source=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const compiled=ts.transpileModule(source('src/components/marathon/MarathonLink.tsx'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^import .*?;\s*$/gm,'');
const NextLink=()=>null;
globalThis.__marathonLinkFixture={_jsx:jsx,Link:NextLink,isMarathonWorkspacePath};
const header='const {_jsx,Link,isMarathonWorkspacePath}=globalThis.__marathonLinkFixture;\n';
const {MarathonLink}=await import('data:text/javascript;base64,'+Buffer.from(header+compiled).toString('base64'));

function withBrowser(run){
 const prior=globalThis.window,calls=[];
 globalThis.window={
  location:{pathname:'/marathon',search:'',hash:''},
  history:{pushState:(...args)=>calls.push(['push',...args]),replaceState:(...args)=>calls.push(['replace',...args])},
  scrollTo:options=>calls.push(['scroll',options])
 };
 try{return run(calls);}
 finally{if(prior===undefined)delete globalThis.window;else globalThis.window=prior;}
}
test('workspace navigation updates native history without invoking the Next page transition',()=>withBrowser(calls=>{
 let prevented=0;
 const href='/marathon/operations?category=safety',element=MarathonLink({href});
 assert.equal(element.type,NextLink);assert.equal(element.props.href,href);
 assert.equal(element.props.prefetch,false);
 element.props.onNavigate({preventDefault:()=>{prevented++;}});
 assert.equal(prevented,1);
 assert.deepEqual(calls,[['push',null,'',href],['scroll',{top:0,behavior:'auto'}]]);
}));
test('workspace replacement and scroll options retain their link semantics',()=>withBrowser(calls=>{
 const element=MarathonLink({href:'/marathon/categories',replace:true,scroll:false});
 element.props.onNavigate({preventDefault:()=>{}});
 assert.deepEqual(calls,[['replace',null,'','/marathon/categories']]);
}));
test('the active workspace link does not add a duplicate history entry',()=>withBrowser(calls=>{
 const element=MarathonLink({href:'/marathon',scroll:false});
 element.props.onNavigate({preventDefault:()=>{}});
 assert.deepEqual(calls,[]);
}));
test('login, school and external links continue through normal Next navigation',()=>withBrowser(calls=>{
 for(const href of ['/marathon/login','/dashboard','https://example.test/']){
  let prevented=false;
  const element=MarathonLink({href,target:'_blank',prefetch:true});
  element.props.onNavigate({preventDefault:()=>{prevented=true;}});
  assert.equal(prevented,false);assert.equal(element.props.target,'_blank');
  assert.equal(element.props.prefetch,true);
 }
 assert.deepEqual(calls,[]);
}));
test('one shared layout owns the workspace while route outlets never remount it',()=>{
 const layout=source('src/app/marathon/layout.tsx');
 assert.equal((layout.match(/<MarathonWorkspace\b/g)||[]).length,1);
 assert.match(layout,/<Suspense\b/);
 for(const page of ['src/app/marathon/page.tsx','src/app/marathon/[section]/page.tsx']){
  assert.doesNotMatch(source(page),/MarathonWorkspace/);
 }
 assert.equal(existsSync(new URL('../../src/app/marathon/page.tsx',import.meta.url)),false);
 assert.equal(existsSync(new URL('../../src/app/marathon/[section]/page.tsx',import.meta.url)),false);
 const workspace=source('src/components/marathon/MarathonWorkspace.tsx');
 assert.match(workspace,/usePathname\(\)/);assert.match(workspace,/useSearchParams\(\)/);
 assert.doesNotMatch(workspace,/window\.history\.(?:pushState|replaceState)\(window\.history\.state/);
});
