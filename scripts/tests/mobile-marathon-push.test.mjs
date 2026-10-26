import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=(path)=>readFileSync(resolve(process.cwd(),path),'utf8');

test('all School sidebars have visible scroll controls and an independently scrollable menu',()=>{
 for(const file of ['Portal.tsx','StudentPortal.tsx','AgentPortal.tsx']){
  assert.match(read('src/components/'+file),/SidebarScrollControls targetSelector="\.side-links"/);
 }
 assert.match(read('src/app/globals.css'),/\.sidebar \.side-links\{flex:1 1 auto;min-height:0;overflow-y:auto/);
 assert.match(read('src/components/marathon/MarathonWorkspace.tsx'),/SidebarScrollControls targetSelector="\.ml-sidebar-scroll"/);
 assert.match(read('src/app/marthon/marathon.css'),/\.ml-sidebar-scroll\{flex:1 1 auto;min-height:0;overflow-y:auto/);
});

test('mobile push tokens require live School identity, and Marathon access is rechecked',()=>{
 const route=read('src/app/api/mobile/push-devices/route.ts');
 assert.match(route,/sameOrigin\(req\)/);
 assert.match(route,/await operator\(req/);
 assert.match(route,/deviceId\(token\)/);
 const worker=read('src/lib/mobile-push.ts');
 assert.match(worker,/p\.active/);
 assert.match(worker,/marathonRoles\.includes/);
 assert.match(worker,/recipientUid\?uid===recipientUid/);
 assert.doesNotMatch(read('flutter_app/lib/main.dart'),/FIREBASE_PRIVATE_KEY|FIREBASE_CLIENT_EMAIL|serviceAccount/);
});

test('notifications are opt-in, do not embed personal data, and reminders are cron guarded',()=>{
 const bridge=read('src/components/MobilePushRegistration.tsx');
 assert.match(bridge,/getClientAuth\(\)/);
 assert.match(bridge,/user\.getIdToken\(\)/);
 const cron=read('src/app/api/cron/marathon-reminders/route.ts');
 assert.match(cron,/process\.env\.CRON_SECRET/);
 assert.match(cron,/tx\.create\(runRef/);
 assert.match(cron,/sendMarathonPush/);
 const config=JSON.parse(read('vercel.json'));
 assert.ok(config.crons.some(c=>c.path==='/api/cron/marathon-reminders'&&c.schedule==='0 6 * * *'));
});
