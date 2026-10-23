import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {
 queueMarathonEdit,pendingMarathonEdits,claimMarathonEdit,acknowledgeMarathonEdit,
 flagMarathonConflict,resolveMarathonEdit,saveMarathonCache,readMarathonCache
} from '../../src/lib/marathon-offline.ts';
import {completionChanges} from '../../src/lib/marathon-task-update.ts';
import {csvEscape,schoolWorkspace} from '../../src/lib/marathon-export.ts';

beforeEach(()=>{globalThis.indexedDB=new IDBFactory();});

test('a later edit survives acknowledgement and syncs on the applied revision',async()=>{
 await queueMarathonEdit('alice','T001',3,{status:'done',notes:'First note'});
 const sent=await claimMarathonEdit('alice:T001');
 await queueMarathonEdit('alice','T001',3,{notes:'Revised while syncing',evidence:'Minutes 14'});
 await acknowledgeMarathonEdit(sent,4);
 const [next]=await pendingMarathonEdits('alice');
 assert.deepEqual(next.changes,{notes:'Revised while syncing',evidence:'Minutes 14'});
 assert.equal(next.expectedRevision,4);
 assert.notEqual(next.mutationId,sent.mutationId);
 assert.equal(next.submitted,undefined);
 const later=await claimMarathonEdit(next.key);
 await acknowledgeMarathonEdit(later,5);
 assert.deepEqual(await pendingMarathonEdits('alice'),[]);
});

test('a lost response retries the original request even after a reload and new edit',async()=>{
 await queueMarathonEdit('alice','T001',3,{notes:'Submitted'});
 const sent=await claimMarathonEdit('alice:T001');
 await queueMarathonEdit('alice','T001',3,{notes:'Newer'});
 const retry=await claimMarathonEdit('alice:T001');
 assert.equal(retry.mutationId,sent.mutationId);
 assert.deepEqual(retry.changes,sent.changes);
 await acknowledgeMarathonEdit(retry,4);
 const [next]=await pendingMarathonEdits('alice');
 // Even if the server's current task is revision 7, acknowledgement uses the
 // original commit's revision 4. The next request must conflict, not overwrite 7.
 assert.equal(next.expectedRevision,4);
 assert.deepEqual(next.changes,{notes:'Newer'});
 // Another tab acknowledging the older request cannot delete this newer edit.
 await acknowledgeMarathonEdit(sent,7);
 assert.equal((await pendingMarathonEdits('alice'))[0].mutationId,next.mutationId);
});

test('parallel tabs merge unsent fields atomically and retain account isolation',async()=>{
 await Promise.all([
  queueMarathonEdit('alice','T001',1,{notes:'Meeting note'}),
  queueMarathonEdit('alice','T001',1,{lead:'Committee'}),
  queueMarathonEdit('alice','T001',1,{evidence:'Letter 21'}),
  queueMarathonEdit('bob','T001',2,{notes:'Private to Bob'})
 ]);
 assert.equal((await pendingMarathonEdits('alice')).length,1);
 assert.deepEqual((await pendingMarathonEdits('alice'))[0].changes,{notes:'Meeting note',lead:'Committee',evidence:'Letter 21'});
 assert.deepEqual((await pendingMarathonEdits('bob'))[0].changes,{notes:'Private to Bob'});
 await saveMarathonCache('alice',{tasks:['alice']});
 assert.equal(await readMarathonCache('bob'),null);
});

test('a conflicted edit stays reviewable while unrelated work can finish',async()=>{
 await queueMarathonEdit('alice','T001',1,{notes:'Local version'});
 await queueMarathonEdit('alice','T002',2,{status:'done'});
 const conflict=await claimMarathonEdit('alice:T001');
 await flagMarathonConflict(conflict,'Another coordinator updated this action.');
 assert.equal(await claimMarathonEdit('alice:T001'),null);
 const independent=await claimMarathonEdit('alice:T002');
 await acknowledgeMarathonEdit(independent,3);
 const [pending]=await pendingMarathonEdits('alice');
 assert.equal(pending.taskId,'T001');
 assert.match(pending.conflict,/coordinator/);
 assert.equal(await resolveMarathonEdit(pending,9),true);
 const resolved=await claimMarathonEdit(pending.key);
 assert.equal(resolved.expectedRevision,9);
 assert.notEqual(resolved.mutationId,conflict.mutationId);
 assert.deepEqual(resolved.changes,{notes:'Local version'});
});

test('a stale comparison cannot discard or rebase a newer local change',async()=>{
 const old=await queueMarathonEdit('alice','T001',1,{notes:'Original'});
 await queueMarathonEdit('alice','T001',1,{notes:'Newer change'});
 assert.equal(await resolveMarathonEdit(old),false);
 assert.equal(await resolveMarathonEdit(old,5),false);
 const [current]=await pendingMarathonEdits('alice');
 assert.equal(current.changes.notes,'Newer change');
 assert.equal(await resolveMarathonEdit(current),true);
 assert.equal((await pendingMarathonEdits('alice')).length,0);
});

test('a transaction that aborts after request success never reports a saved edit',async()=>{
 const original=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(...args){
  const request=original.apply(this,args);
  request.addEventListener('success',()=>this.transaction.abort());
  return request;
 };
 try{await assert.rejects(queueMarathonEdit('alice','T001',1,{notes:'Must not be lost silently'}),/commit/);}
 finally{IDBObjectStore.prototype.put=original;}
 assert.deepEqual(await pendingMarathonEdits('alice'),[]);
});

const done={status:'done',completedAt:'2026-10-20T10:13:47.000Z',completedBy:'original-coordinator',recordedAt:'2026-10-21T11:00:00.000Z'};
const now='2026-10-23T14:00:00.000Z';
test('editing notes or resubmitting Done preserves original completion attribution',()=>{
 for(const changes of [{notes:'Extra evidence'},{status:'done',notes:'Extra evidence'},{status:'done',completedAt:done.completedAt}]){
  const result={...done,...changes,...completionChanges(done,changes,'later-editor',now)};
  assert.equal(result.completedBy,'original-coordinator');
  assert.equal(result.recordedAt,done.recordedAt);
  assert.equal(result.completedAt,done.completedAt);
 }
});
test('explicit backdating or completing records the actor and entry time; reopening clears completion',()=>{
 assert.deepEqual(completionChanges(done,{status:'done',completedAt:'2026-10-19T09:00:00.000Z'},'coordinator',now),{
  completedAt:'2026-10-19T09:00:00.000Z',completedBy:'coordinator',recordedAt:now
 });
 assert.deepEqual(completionChanges({...done,status:'todo',completedAt:null},{status:'done'},'coordinator',now),{
  completedAt:now,completedBy:'coordinator',recordedAt:now
 });
 assert.deepEqual(completionChanges(done,{status:'todo'},'coordinator',now),{completedAt:null,completedBy:null,recordedAt:now});
 assert.throws(()=>completionChanges({...done,status:'todo'},{completedAt:done.completedAt},'coordinator',now));
});
test('CSV values cannot become spreadsheet formulas and still quote commas, quotes and newlines',()=>{
 for(const value of ['=HYPERLINK("https://example.org")','+1+1','-1+1','@SUM(1,1)','  =1+1','\tcommand','\rcommand','＝1+1']){
  assert.ok(csvEscape(value).startsWith('"\''),value);
 }
 assert.equal(csvEscape('A "quote", here\nand there'),'"A ""quote"", here\nand there"');
 assert.equal(csvEscape('KASA Life Marathon'),'"KASA Life Marathon"');
 assert.equal(csvEscape(null),'""');
});
test('all supported school roles return to the correct existing portal',()=>{
 assert.equal(schoolWorkspace('finance'),'/dashboard/finance');
 for(const role of ['super_admin','admin','reviewer'])assert.equal(schoolWorkspace(role),'/dashboard');
 assert.equal(schoolWorkspace('agent'),'/agent-portal');
 assert.equal(schoolWorkspace('student'),'/student-portal');
});
