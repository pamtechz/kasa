import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(p)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');

test('130 source actions retain stable IDs',()=>{
 const s=JSON.parse(source('src/data/marathon-seed.json'));
 assert.equal(s.items.length,130);
 assert.equal(new Set(s.items.map(x=>x.id)).size,130);
 assert(s.items.some(t=>t.id==='WEB-01'&&t.title.includes('web developer')));
 assert(s.items.some(t=>t.id==='WEB-02'&&t.title.includes('web design')));
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

test('only existing school super admin may assign secondary role',()=>{
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
 assert.match(grant,/getUserByEmail\(email\)/);
 assert.match(grant,/emailVerified/);
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
 assert.match(imp,/batch\.create/);
});

test('Marathon direct Firestore writes remain blocked',()=>{
 const rules=source('firestore.rules');
 assert.match(rules,/match \/\{document=\*\*\} \{\s*allow read, write: if false/);
});
