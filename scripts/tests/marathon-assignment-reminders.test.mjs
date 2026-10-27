import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('only Marathon admins can assign active members, with an audit trail',()=>{
 const api=read('src/app/api/marathon/tasks/[id]/assignees/route.ts');
 const access=read('src/lib/marathon-assignment.ts');
 assert.match(access,/\['super_admin','kasaAdmin','kasaOperations'\]/);
 assert.match(access,/p\.role==='student'/);
 assert.match(access,/p\.active!==true/);
 assert.match(access,/marathonAccess\?\.active===true/);
 assert.match(api,/canAssignMarathonTasks\(actor\.role\)/);
 assert.match(api,/validateMarathonAssignees\(assigneeUids\)/);
 assert.match(api,/Number\(before\.revision\)!==body\.data\.expectedRevision/);
 assert.match(api,/tx\.create\(db\.collection\('marathonAudit'\)/);
 assert.match(api,/sendMarathonPush\(/);
 assert.match(api,/newAssignees/);
});
test('only the assigned identity can report own completion without closing official task',()=>{
 const code=read('src/app/api/marathon/tasks/[id]/confirmation/route.ts');
 assert.match(code,/marathonIdentity\(req\)/);
 assert.match(code,/prior\.assigneeUids\.includes\(identity\.uid\)/);
 assert.match(code,/z\.enum\(\['done','not_done'\]\)/);
 assert.match(code,/tx\.create\(db\.collection\('marathonAudit'\)/);
 assert.doesNotMatch(code,/status:'done',revision:/);
});
test('private pushes target members, three daily slots and exclude completed work',()=>{
 const push=read('src/lib/mobile-push.ts');
 const cron=read('src/app/api/cron/marathon-reminders/route.ts');
 const config=JSON.parse(read('vercel.json'));
 assert.match(push,/recipientUid\|\|d\.uid===recipientUid/);
 assert.match(cron,/SLOTS=\[8,13,18\]/);
 assert.match(cron,/today\+'-'\+hour/);
 assert.match(cron,/task\.confirmationByUid\?\.\[uid\]\?\.status==='done'/);
 assert.match(cron,/task\.status==='done'/);
 assert.match(cron,/recipients\.set\(uid/);
 assert.match(cron,/CRON_SECRET/);
 assert(config.crons.some(x=>x.path==='/api/cron/marathon-reminders'&&x.schedule==='0 6,11,16 * * *'));
});
test('the workspace exposes assignment pages and member outcome popup',()=>{
 const work=read('src/components/marathon/MarathonWorkspace.tsx');
 const panel=read('src/components/marathon/MarathonAssignmentPanel.tsx');
 const prompt=read('src/components/marathon/MarathonConfirmationPrompt.tsx');
 assert.match(work,/My assignments/);
 assert.match(work,/MarathonAssignmentPanel task=\{drawer\}/);
 assert.match(work,/MarathonConfirmationPrompt uid=\{uid\}/);
 assert.match(panel,/Assigned members/);
 assert.match(panel,/Report done/);
 assert.match(prompt,/Has this task been completed\?/);
 assert.match(prompt,/Remind me later/);
});
