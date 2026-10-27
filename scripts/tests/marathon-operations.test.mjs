import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(p)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');

test('the revised document supplies 186 unique actions across 15 workstreams',()=>{
 const s=JSON.parse(source('src/data/marathon-seed.json'));
 assert.equal(s.items.length,186);
 assert.equal(new Set(s.items.map(x=>x.id)).size,186);
 assert.equal(s.sections.length,15);
 assert.equal(s.items.filter(x=>x.status==='done').length,5);
 assert.equal(s.items.filter(x=>x.dateCorrection).length,65);
 assert.equal(s.venue,'Showgrounds, Polo Field B, Lusaka');
 assert(s.items.some(t=>t.id==='T001'&&t.title==='Confirm event date and Event Sanction'));
 const old=JSON.parse(source('src/data/marathon-seed-2026-10-23.json'));
 assert.equal(old.items.length,130);
 assert(old.items.some(t=>t.id==='WEB-01'));
 assert(old.items.some(t=>t.id==='WEB-02'));
});

test('dual workspace roles reside in the existing school profile',()=>{
 const types=source('src/lib/types.ts');
 const auth=source('src/lib/marathon.ts');
 const list=source('src/app/api/marathon/bootstrap/route.ts');
 assert.match(types,/marathonAccess\?:MarathonAccess/);
 assert.match(types,/uid:string; email:string; displayName:string; role:Role; active:boolean/);
 assert.match(auth,/db\.collection\('profiles'\)\.doc\(verified.uid\)/);
 assert.match(auth,/profile\.active!==true/);
 assert.match(auth,/profile\.role==='super_admin'/);
 assert.match(auth,/profile\.marathonAccess/);
 assert.match(auth,/marathonRoles\.includes\(secondRole\.role\)/);
 assert.doesNotMatch(auth,/collection\('marathonMembers'\)/);
 assert.match(list,/db\.collection\('profiles'\)\.where\('marathonAccess\.role'/);
});

test('only School super admin may assign secondary role and auto-create School identity',()=>{
 const grant=source('src/app/api/marathon/members/route.ts');
 const change=source('src/app/api/marathon/members/[uid]/route.ts');
 const auth=source('src/lib/marathon.ts');
 assert.match(auth,/canManage\(role:MarathonRole\)\{return role==='super_admin'/);
 for(const code of [grant,change]){
  assert.match(code,/requireMarathon\(actor,'super'\)/);
  assert.match(code,/collection\('profiles'\)/);
  assert.match(code,/marathonAccess:/);
  assert.match(code,/marathonAudit/);
  assert.doesNotMatch(code,/collection\('marathonMembers'\)/);
 }
 assert.match(grant,/ensureSchoolIdentity\(/);
 assert.match(grant,/verificationPending/);
 assert.match(grant,/schoolAccountCreated/);
 assert.match(grant,/if\(!snap.exists\)/);
 assert.match(change,/uid===actor.uid/);
});

test('Marathon task writes require role, audit and concurrency control',()=>{
 const task=source('src/app/api/marathon/tasks/[id]/route.ts');
 const imp=source('src/app/api/marathon/import/route.ts');
 assert.match(task,/requireMarathon\(identity,'edit'\)/);
 assert.match(task,/expectedRevision/);
 assert.match(task,/mutationId/);
 assert.match(task,/HttpError\(409/);
 assert.match(imp,/requireMarathon\(actor,'super'\)/);
 assert.match(imp,/applyChecklistImport/);
 assert.match(imp,/planHash/);
});

test('Marathon direct Firestore writes remain blocked',()=>{
 const rules=source('firestore.rules');
 assert.match(rules,/match \/\{document=\*\*\} \{\s*allow read, write: if false/);
});

test('Marathon CI imports do not initialize Firebase Admin services',()=>{
 const auth=source('src/lib/marathon.ts');
 assert.doesNotMatch(auth,/export const marathonCollection\s*=\s*db\.collection\(/);
 assert.match(auth,/export function marathonCollection\(\)/);
});
test('Marathon shares one KASA login and redirects only after server-verified role lookup',()=>{
 const redirect=source('src/app/marathon/login/page.tsx');
 const login=source('src/app/(site)/login/page.tsx');
 const routing=source('src/lib/workspace-routing.ts');
 assert.match(redirect,/redirect\('\/login\?next=%2Fmarathon'\)/);
 assert.doesNotMatch(redirect,/signInWithEmailAndPassword/);
 assert.match(login,/signInWithEmailAndPassword\(firebaseAuth,/);
 assert.match(login,/sendEmailVerification\(cred\.user\)/);
 assert.match(login,/adminPasswordProvisionedAt/);
 assert.match(login,/workspaceDestination\(data\.profile as Profile,requested\)/);
 assert.match(routing,/role==='marathon_only'/);
 assert.match(routing,/profile\.role!=='student'/);
});

