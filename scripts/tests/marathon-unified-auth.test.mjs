import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workspaceDestination,mayAccessMarathon,mayAccessSchool} from '../../src/lib/workspace-routing.ts';

const source=(name)=>readFileSync(new URL('../../'+name,import.meta.url),'utf8');
const marathon={role:'marathon_only',active:true,marathonAccess:{role:'kasaEditor',active:true}};
const student={role:'student',active:true,marathonAccess:{role:'kasaAdmin',active:true}};
const staff={role:'admin',active:true,marathonAccess:{role:'kasaOperations',active:true}};

test('new members have Marathon-only School profile and are never students',()=>{
 const grant=source('src/app/api/marathon/members/route.ts');
 const identity=source('src/lib/marathon.ts');
 const edit=source('src/app/api/marathon/members/[uid]/route.ts');
 assert.match(grant,/schoolRole:'marathon_only'/);
 assert.match(grant,/profile\.role==='student'/);
 assert.match(identity,/if\(profile\.role==='student'\)throw new HttpError\(403/);
 assert.match(edit,/if\(profile\.role==='student'\)throw new HttpError\(403/);
 assert.match(source('src/lib/permissions.ts'),/marathon_only:\[\]/);
 assert.match(source('src/app/api/admin/users/provision/route.ts'),/previousRole==='marathon_only'/);
 assert.match(source('src/app/api/admin/users/[id]/route.ts'),/currentData.role==='marathon_only'/);
 assert.match(source('src/lib/student-access.ts'),/profile\.data\(\)\?\.role!=='student'/);
 assert.match(source('src/app/api/mobile/push-devices/route.ts'),/'marathon_only'/);
 assert.match(source('src/lib/mobile-push.ts'),/profile\.role!=='student'/);
 assert.match(source('src/app/api/mobile/push-devices/route.ts'),/profile\.role!=='student'/);
});
test('Marathon-only identities route to the event, not to School or Student portals',()=>{
 assert.equal(mayAccessSchool('marathon_only'),false);
 assert.equal(mayAccessMarathon(marathon),true);
 for(const next of [null,'/student-portal','/dashboard','/agent-portal','//evil.example','/marathon/login','/bootstrap']){
  assert.equal(workspaceDestination(marathon,next),'/marathon');
 }
 assert.equal(workspaceDestination({...marathon,marathonAccess:{role:'kasaEditor',active:false}},'/marathon'),null);
 assert.equal(workspaceDestination({...marathon,active:false},null),null);
});
test('student accounts cannot enter Marathon even with a stale Marathon role',()=>{
 assert.equal(mayAccessMarathon(student),false);
 assert.equal(workspaceDestination(student,'/marathon/operations'),'/student-portal');
 assert.equal(workspaceDestination(student,'/student-portal'),'/student-portal');
 assert.equal(workspaceDestination({...student,active:false},null),null);
});
test('staff may enter only their authorized School and Marathon paths',()=>{
 assert.equal(workspaceDestination(staff,'/marathon/operations'),'/marathon/operations');
 assert.equal(workspaceDestination(staff,null),'/dashboard');
 assert.equal(workspaceDestination(staff,'https://evil.example'),'/dashboard');
 assert.equal(workspaceDestination(staff,'//evil.example'),'/dashboard');
 assert.equal(workspaceDestination(staff,'/marathon/../dashboard'),'/dashboard');
 assert.equal(workspaceDestination({...staff,marathonAccess:{role:'kasaOperations',active:false}},'/marathon'),'/dashboard');
 const schoolOnly={role:'reviewer',active:true};
 assert.equal(workspaceDestination(schoolOnly,'/marathon'),'/dashboard/applications');
});
test('only one login exists and KASA official logo is used',()=>{
 const redirect=source('src/app/marathon/login/page.tsx');
 assert.match(redirect,/redirect\('\/login\?next=%2Fmarathon'\)/);
 assert.match(source('src/components/marathon/MarathonWorkspace.tsx'),/<BrandLogo size=\{42\}/);
 const pubspec=source('flutter_app/pubspec.yaml');
 assert.match(pubspec,/flutter_launcher_icons:/);
 assert.match(pubspec,/kasa-logo-white\.png/);
 assert.match(source('.github/workflows/flutter-release.yml'),/dart run flutter_launcher_icons/);
});
