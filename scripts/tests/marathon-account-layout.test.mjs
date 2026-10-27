import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('canonical /marathon is rendered natively and legacy /marthon permanently redirects',()=>{
 const config=source('next.config.ts');
 const layout=source('src/app/marathon/layout.tsx');
 assert.match(config,/source:'\/marthon\/:path\*',destination:'\/marathon\/:path\*',permanent:true/);
 assert.match(layout,/<MarathonContentSwitch>/);
 assert.match(source('src/components/marathon/MarathonContentSwitch.tsx'),/<MarathonWorkspace\/>/);
 assert.match(layout,/<MarathonOfflineWorker\/>/);
 assert.doesNotMatch(source('src/app/marathon/page.tsx'),/redirect\(/);
 assert.match(source('src/app/marathon/login/page.tsx'),/redirect\('\/login\?next=%2Fmarathon'\)/);
 assert.match(source('src/components/marathon/MarathonOfflineWorker.tsx'),/scope:'\/marathon'/);
 assert.match(source('public/marathon-sw.js'),/const SHELL=\['\/marathon'/);
});
test('sidebar countdown and scroll buttons are removed and countdown stays in the main dashboard',()=>{
 const workspace=source('src/components/marathon/MarathonWorkspace.tsx');
 const css=source('src/app/marthon/marathon.css');
 assert.doesNotMatch(workspace,/ml-sidebar-event|ml-sidebar-bottom|SidebarScrollControls/);
 assert.match(workspace,/className="ml-countdown-strip"/);
 assert.ok(workspace.indexOf('className="ml-content"')<workspace.indexOf('className="ml-countdown-strip"'));
 assert.match(css,/\.ml-sidebar\.is-collapsed/);
 assert.match(workspace,/kasa_marathon_sidebar_collapsed/);
 assert.match(workspace,/onClick=\{toggleSidebar\}/);
 for(const page of ['Portal.tsx','AgentPortal.tsx','StudentPortal.tsx']){
  const content=source('src/components/'+page);
  assert.doesNotMatch(content,/SidebarScrollControls|className="side-bottom"/);
  assert.match(content,/<AccountMenu /);
 }
});
test('profile icon provides an accessible hover/touch account menu and sign-out',()=>{
 const menu=source('src/components/AccountMenu.tsx');
 const css=source('src/app/globals.css');
 assert.match(menu,/aria-expanded=\{open\}/);
 assert.match(menu,/aria-label="Open account menu"/);
 assert.match(menu,/onMouseLeave/);
 assert.match(menu,/onSignOut/);
 assert.match(css,/\.kasa-account-menu:hover \.kasa-account-popover/);
 assert.match(css,/\.kasa-account-menu:focus-within \.kasa-account-popover/);
 assert.match(source('src/components/marathon/MarathonWorkspace.tsx'),/<AccountMenu /);
});
