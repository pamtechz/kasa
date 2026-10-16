import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=(path)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('browser extension attribute mismatch is suppressed only on the body element',()=>{
 const layout=source('src/app/layout.tsx');
 assert.match(layout,/<body suppressHydrationWarning>/);
 assert.doesNotMatch(layout,/<html[^>]*suppressHydrationWarning/);
});

test('Firebase browser initialization waits for all named settings',()=>{
 const client=source('src/lib/firebase-client.ts');
 assert.match(client,/missingFirebaseBrowserSettings\.length===0/);
 assert.match(client,/firebaseConfigured\s*\?/);
 assert.match(client,/firebaseApp:FirebaseApp\|null/);
 assert.match(client,/auth:Auth\|null/);
 for(const key of ['API_KEY','AUTH_DOMAIN','PROJECT_ID','APP_ID','STORAGE_BUCKET']){
  assert.match(client,new RegExp('NEXT_PUBLIC_FIREBASE_'+key));
 }
});

test('bootstrap and login explain missing local keys',()=>{
 const bootstrap=source('src/app/bootstrap/page.tsx');
 const login=source('src/app/(site)/login/page.tsx');
 assert.match(bootstrap,/missingFirebaseBrowserSettings\.join/);
 assert.match(login,/missingFirebaseBrowserSettings\.join/);
 assert.match(bootstrap,/\.env\.local/);
 assert.match(login,/\.env\.local/);
});

test('development bootstrap does not require production-only App Check',()=>{
 const bootstrap=source('src/app/bootstrap/page.tsx');
 const readiness=source('src/lib/readiness.ts');
 assert.match(bootstrap,/process\.env\.NODE_ENV==='production'&&\!appCheck/);
 assert.match(readiness,/process\.env\.NODE_ENV==='production'&&\!process\.env\.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY/);
});

test('Firebase diagnostics never print credential values',()=>{
 const cli=source('scripts/firebase-env-doctor.mjs');
 assert.match(cli,/console\.log\('  '\+\(process\.env\[name\]\?\.trim\(\)\?/);
 assert.doesNotMatch(cli,/console\.log\(process\.env\[name\]\)/);
 assert.doesNotMatch(cli,/console\.log\(process\.env\.FIREBASE_PRIVATE_KEY\)/);
 const pkg=JSON.parse(source('package.json'));
 assert.equal(pkg.scripts['doctor:firebase'],'node --env-file=.env.local scripts/firebase-env-doctor.mjs');
 const vercel=JSON.parse(source('vercel.json'));
 assert.equal(vercel.git.deploymentEnabled,false);
});
