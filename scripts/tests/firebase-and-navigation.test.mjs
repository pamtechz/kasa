import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(file)=>readFileSync(new URL('../../'+file,import.meta.url),'utf8');

test('Firebase App Check browser API uses exports supported by the modular SDK',()=>{
 const client=source('src/lib/firebase-client.ts');
 assert.match(client,/import\s*\{[^}]*\bgetToken\b[^}]*\}\s*from\s*['"]firebase\/app-check['"]/);
 assert.doesNotMatch(client,/\bgetLimitedUseToken\b\s*\(/);
});
test('server verifies standard Firebase App Check tokens without one-time consumption',()=>{
 const security=source('src/lib/security.ts');
 assert.match(security,/appCheck\.verifyToken\(token\)/);
 assert.doesNotMatch(security,/appCheck\.verifyToken\(token,\s*\{\s*consume:\s*true/);
});
test('homepage and public site have togglable accessible navigation',()=>{
 const home=source('src/app/page.tsx');
 const site=source('src/components/SiteChrome.tsx');
 assert.match(home,/aria-controls="kasa-home-navigation"/);
 assert.match(home,/aria-expanded=\{navOpen\}/);
 assert.match(site,/aria-controls="kasa-public-menu"/);
});
test('dashboard mobile sidebar has accessibility and keyboard close hooks',()=>{
 const portal=source('src/components/Portal.tsx');
 assert.match(portal,/aria-controls="kasa-admin-navigation"/);
 assert.match(portal,/event\.key==='Escape'/);
 assert.match(portal,/aria-current=/);
});

test('Auth is explicitly nullable and sign-out is guarded',()=>{
 const client=source('src/lib/firebase-client.ts');
 const student=source('src/app/(site)/my-applications/page.tsx');
 const portal=source('src/components/Portal.tsx');
 assert.match(client,/auth:Auth\|null\s*=/);
 assert.match(client,/export async function signOutClient\(/);
 assert.match(client,/if\(!auth\)return;/);
 assert.doesNotMatch(student,/signOut\(auth\)/);
 assert.doesNotMatch(portal,/signOut\(auth\)/);
 assert.match(student,/status==='unavailable'/);
 assert.match(student,/status==='guest'/);
});
test('secure login requires initialized Firebase Auth and preserves allowlisted routes',()=>{
 const login=source('src/app/(site)/login/page.tsx');
 assert.match(login,/requireClientAuth\(\)/);
 const routing=source('src/lib/workspace-routing.ts');
 assert.match(login,/workspaceDestination\(data\.profile as Profile,requested\)/);
 assert.match(routing,/next==='\/bootstrap'/);
 assert.match(routing,/\['\/student-portal','\/my-applications'\]/);
 assert.doesNotMatch(login,/signInWithEmailAndPassword\(auth,/);
});
test('Vercel automatic Git deployment is explicitly disabled',()=>{
 const settings=JSON.parse(source('vercel.json'));
 assert.equal(settings.git?.deploymentEnabled,false);
});
