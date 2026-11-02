import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const require=createRequire(import.meta.url);
const load=(path,stubs)=>{
 const code=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 new Function('require','exports',code)(id=>Object.hasOwn(stubs,id)?stubs[id]:require(id),exports);
 return exports;
};
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=e=>Response.json({error:e.message},{status:e.status||500});
const json=value=>Response.json(value);
const id='00000000-0000-4000-8000-000000000000';
function fixture({ownerUid='user-1',purpose='personal-document',status='ready'}={}){
 const file={ownerUid,purpose,status,connectionId:'own',key:'private/user-1/personal-document/'+id+'.pdf'};
 const metadata={},grant={};
 const refs={
  r2Files:{data:()=>file},r2InstitutionShares:{data:()=>grant}
 };
 const db={collection:name=>({doc:()=>({name,
  get:async()=>({data:()=>name==='r2Files'?file:grant})
 })}),runTransaction:async fn=>fn({
  get:async ref=>({data:()=>ref.name==='r2Files'?file:grant}),
  update:(_ref,values)=>Object.assign(file,values),
  set:(_ref,values)=>Object.assign(grant,values),
  delete:()=>{for(const k of Object.keys(grant))delete grant[k];}
 })};
 const deps={
  '@/lib/firebase-admin':{db},'@/lib/errors':{HttpError,fail,json},
  '@/lib/security':{sameOrigin:()=>{},audit:async()=>{}},
  '@/lib/r2-storage':{storageIdentity:async()=>({uid:'user-1'})}
 };
 const route=load('src/app/api/r2/files/[id]/kasa-access/route.ts',deps);
 const act=(approved)=>route.PATCH(new Request('https://kasa.test/api/r2/files/'+id+'/kasa-access',{method:'PATCH',body:JSON.stringify({approved})}),{params:Promise.resolve({id})});
 return {file,grant,act,metadata};
}
test('only the actual owner can grant KASA access to an already verified private document',async()=>{
 const a=fixture();
 assert.equal((await a.act(true)).status,200);
 assert.equal(a.file.sharedWithKasa,true);
 assert.equal(a.grant.fileId,id);
 assert.equal(a.grant.ownerUid,'user-1');
 const other=fixture({ownerUid:'another-user'});
 assert.equal((await other.act(true)).status,404);
 assert.deepEqual(other.grant,{});
 const photo=fixture({purpose:'profile-photo'});
 assert.equal((await photo.act(true)).status,404);
 const pending=fixture({status:'pending'});
 assert.equal((await pending.act(true)).status,404);
});
test('owner revocation removes institutional grant, while preserving their file and bucket',async()=>{
 const a=fixture();
 await a.act(true);
 const revoke=await a.act(false);
 assert.equal(revoke.status,200);
 assert.equal(a.file.sharedWithKasa,false);
 assert.deepEqual(a.grant,{});
 assert.equal(a.file.connectionId,'own');
});
test('staff access has a server-side authorization and consent guard',()=>{
 const listing=read('src/app/api/admin/r2/shared/route.ts');
 const detail=read('src/app/api/admin/r2/shared/[id]/route.ts');
 const permissions=read('src/lib/permissions.ts');
 const rules=read('firestore.rules');
 assert.match(listing,/operator\(req,\['super_admin','admin','reviewer'\]\)/);
 assert.match(detail,/file\.sharedWithKasa!==true/);
 assert.match(detail,/grant\.ownerUid!==file\.ownerUid/);
 assert.match(detail,/signedR2Read/);
 assert.match(permissions,/\/api\/admin\/r2\/shared/);
 assert.match(rules,/match \/r2InstitutionShares\/\{id\} \{ allow read, write: if false;/);
});
test('the file picker shows explicit opt-in and revocation actions',()=>{
 const src=read('src/components/R2StoragePanel.tsx');
 assert.match(src,/Share with KASA/);
 assert.match(src,/Revoke KASA access/);
 assert.match(src,/file\.purpose==='personal-document'/);
 assert.match(read('src/app/api/r2/files/route.ts'),/sharedWithKasa/);
});

test('staff get a dedicated view and each download is authorized on the server',()=>{
 const profile=read('src/app/(portal)/dashboard/profile/page.tsx');
 const panel=read('src/components/R2KasaSharedFilesPanel.tsx');
 assert.match(profile,/R2KasaSharedFilesPanel/);
 assert.match(panel,/\/api\/admin\/r2\/shared/);
 assert.match(panel,/Open authorized document/);
 assert.match(panel,/authHeaders/);
});
