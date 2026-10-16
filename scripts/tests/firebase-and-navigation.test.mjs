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
