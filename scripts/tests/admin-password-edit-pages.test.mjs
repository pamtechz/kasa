import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('Password recovery is super-admin-only, recipient-bound, throttled, and never returns secret links',()=>{
 const route=read('src/app/api/admin/users/[id]/password-reset/route.ts');
 const policy=read('src/lib/permissions.ts');
 assert.match(route,/operator\(req,\['super_admin'\]\)/);
 assert.match(route,/body\?\.confirm!==true/);
 assert.match(route,/sameOrigin\(req\)/);
 assert.match(route,/uid===actor\.uid/);
 assert.match(route,/profile\.role==='super_admin'/);
 assert.match(route,/user\.email\.toLowerCase\(\)!==String\(profile\.email\)\.toLowerCase\(\)/);
 assert.match(route,/COOLDOWN_MS=15\*60\*1000/);
 assert.match(route,/db\.runTransaction/);
 assert.match(route,/requestType:'PASSWORD_RESET'/);
 assert.match(route,/user\.password_reset_requested/);
 assert.doesNotMatch(route,/adminAuth\.updateUser\(uid,\{password/);
 assert.doesNotMatch(route,/generatePasswordResetLink/);
 assert.match(policy,/users\/\[\^\/\]\+\/password-reset/);
});
test('Dedicated editors replace account, agent, programme/announcement and Marathon task overlays',()=>{
 const staff=read('src/app/(portal)/dashboard/staff/page.tsx');
 const agent=read('src/app/(portal)/dashboard/agents/page.tsx');
 const content=read('src/components/ContentEditor.tsx');
 const marathon=read('src/components/marathon/MarathonWorkspace.tsx');
 const finance=read('src/app/(portal)/dashboard/finance/page.tsx');
 for(const src of [staff,agent,content,marathon,finance])
  assert.doesNotMatch(src,/modal-page-overlay|ml-modal-backdrop/,src.slice(0,50));
 assert.match(staff,/\/dashboard\/staff\//);
 assert.match(agent,/\/dashboard\/agents\//);
 assert.match(content,/editor-page-layout/);
 assert.match(marathon,/ml-task-editor-page/);
 assert.match(finance,/\/dashboard\/finance\//);
 assert.match(read('src/app/(portal)/dashboard/staff/[uid]/edit/page.tsx'),/sendReset/);
 assert.match(read('src/app/(portal)/dashboard/finance/[id]/[action]/page.tsx'),/FinanceQuoteReconcile/);
});
test('New edit pages preserve server-side permissions and write origin verification',()=>{
 const school=read('src/app/api/admin/users/[id]/route.ts');
 const agent=read('src/app/api/admin/agents/[id]/route.ts');
 assert.match(school,/Only a Super Administrator can assign account roles/);
 assert.match(school,/Password changes must use verified account recovery/);
 assert.match(agent,/sameOrigin\(req\)/);
 assert.match(agent,/operator\(req,\['super_admin','admin'\]\)/);
});
