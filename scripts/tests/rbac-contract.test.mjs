import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
test('server authorization is enforced by role grants before accessing administrative data',()=>{
 const s=read('src/lib/security.ts');
 assert.match(s,/operator\(req,\[\.\.\.grants\[permission\]\]\)/);
 assert.match(s,/Not authorized for this operation/);
 for(const path of ['src/app/api/admin/finance/route.ts','src/app/api/admin/forms/route.ts',
 'src/app/api/admin/intake/route.ts','src/app/api/admin/content/route.ts',
 'src/app/api/admin/staff/route.ts','src/app/api/admin/submissions/[id]/route.ts'])
 assert.match(read(path),/requirePermission\(req,/);
});
test('dashboard permissions also hide links and deny deep links',()=>{
 const p=read('src/components/Portal.tsx');
 assert.match(p,/baseLinks\.filter\(link=>canViewDashboard/);
 assert.match(p,/!canViewDashboard\(result\.profile\.role,path\)/);
});
test('Firestore and Storage do not trust role claims for private client data',()=>{
 assert.match(read('firestore.rules'),/match \/\{document=\*\*\}/);
 assert.match(read('storage.rules'),/match \/\{allPaths=\*\*\}/);
});
