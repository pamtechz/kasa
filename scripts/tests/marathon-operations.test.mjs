import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path=(p)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('migration includes exactly 130 unique source actions',()=>{
 const s=JSON.parse(path('src/data/marathon-seed.json'));
 assert.equal(s.items.length,130);
 assert.equal(new Set(s.items.map(x=>x.id)).size,130);
 assert(s.items.some(x=>x.id==='WEB-01'&&x.title.includes('web developer')));
 assert(s.items.some(x=>x.id==='WEB-02'&&x.title.includes('web design')));
 assert(s.items.every(x=>x.status==='todo'||x.status==='done'));
});
test('Marathon server API requires explicit member roles',()=>{
 const auth=path('src/lib/marathon.ts');
 assert.match(auth,/verifyIdToken\(/);
 assert.match(auth,/marathonMembers/);
 assert.match(auth,/email_verified/);
 assert.match(auth,/super_admin/);
 const task=path('src/app/api/marathon/tasks/[id]/route.ts');
 assert.match(task,/requireMarathon\(identity,'edit'\)/);
 assert.match(task,/expectedRevision/);
 assert.match(task,/mutationId/);
 assert.match(task,/HttpError\(409/);
 const imp=path('src/app/api/marathon/import/route.ts');
 assert.match(imp,/requireMarathon\(actor,'super'\)/);
 assert.match(imp,/batch\.create/);
});
test('No direct client Firestore access permitted for Marathon collections',()=>{
 const rules=path('firestore.rules');
 assert.match(rules,/match \/\{document=\*\*\} \{\s*allow read, write: if false/);
});
