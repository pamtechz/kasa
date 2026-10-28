import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
function load(path,stubs){
 const js=ts.transpileModule(read(path),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
 const exports={};
 new Function('require','exports',js)(name=>name==='server-only'?{}:
  Object.hasOwn(stubs,name)?stubs[name]:require(name),exports);
 return exports;
}
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const errors={HttpError};
const bucket={accountId:'a'.repeat(32),bucket:'institutional',jurisdiction:'default',accessKeyId:'test',secretAccessKey:'test'};
const fakeSigning=(c,method,path,ttl,type)=>'https://r2.test/'+method+'/'+path;
function library(configured=true){
 return load('src/lib/institutional-storage.ts',{
  './errors':errors,'./r2-storage':{platformR2:()=>configured?bucket:null},
  './r2-signing':{signR2Url:fakeSigning}
 });
}

test('institutional R2 refuses arbitrary and private user paths',()=>{
 const lib=library();
 for(const bad of ['../secret','private/other/photo.png','r2-staging/../../secret.pdf',
  'r2-public-media/invalid.jpg','r2-acceptance-pack/illegal']){
  assert.throws(()=>lib.institutionalReadUrl(bad));
 }
 assert.match(lib.institutionalReadUrl('r2-staging/00000000-0000-4000-8000-000000000000.pdf'),/r2-staging/);
 assert.match(lib.institutionalReadUrl('r2-public-media/00000000-0000-4000-8000-000000000000.png'),/r2-public-media/);
 assert.throws(()=>library(false).institutionalReadUrl('r2-staging/00000000-0000-4000-8000-000000000000.pdf'),/not configured/);
});

test('retired binary upload routes reject the request without reading its body',async()=>{
 for(const path of ['src/app/api/public/upload/route.ts','src/app/api/admin/settings/acceptance-letter/upload/route.ts','src/app/api/r2/oauth/upload/route.ts']){
  const route=load(path,{'@/lib/errors':{json:(data,status)=>Response.json(data,{status})}});
  const request={formData:()=>assert.fail('must not consume binary data'),arrayBuffer:()=>assert.fail('must not consume binary data')};
  const response=await route.POST(request);assert.equal(response.status,410);
  assert.equal((await response.json()).code,'DIRECT_UPLOAD_REQUIRED');
 }
 assert.equal(library().uploadInstitutionalObject,undefined);
});
test('external-only client has no server or shared-bucket fallback',()=>{
 const client=read('src/lib/r2-upload-client.ts');
 assert.doesNotMatch(client,/new FormData|platformAvailable|return false/);
 assert.match(client,/credentials:'omit',redirect:'error'/);
 const start=read('src/app/api/r2/uploads/route.ts');
 assert.match(start,/connectionId==='platform'/);
 assert.match(start,/active.some/);
});
test('KASA preserves old file reads, guest forms, and image picker path validation',()=>{
 const validator=read('src/lib/schema.ts');
 const submit=read('src/app/api/public/forms/[slug]/submit/route.ts');
 const staff=read('src/app/api/admin/file/route.ts');
 const dynamic=read('src/components/DynamicForm.tsx');
 assert.match(validator,/r2-staging/);
 assert.match(validator,/f\.type==='image'/);
 assert.match(submit,/institutionalObjectHead/);
 assert.match(submit,/storage\.bucket\(\)\.file/);
 assert.match(staff,/institutionalReadUrl/);
 assert.match(staff,/storage\.bucket\(\)\.file/);
 assert.match(dynamic,/f\.type==='image'&&<div className="upload-box">/);
 assert.doesNotMatch(dynamic,/Open Cloudinary Console/);
});
test('large official PDF uses admin-only direct uploads with a reviewed ready asset',()=>{
 const start=read('src/app/api/r2/uploads/route.ts');
 const finish=read('src/app/api/r2/uploads/[id]/complete/route.ts');
 const client=read('src/app/(portal)/dashboard/settings/acceptance-letter/page.tsx');
 const attach=read('src/app/api/admin/settings/acceptance-letter/attach/route.ts');
 const pdf=read('src/lib/custom-acceptance-pdf.ts');
 assert.match(start,/acceptance-pdf/);
 assert.match(start,/identity.profile.role/);
 assert.match(start,/v.contentType!=='application\/pdf'/);
 assert.match(start,/connectionId/);
 assert.match(finish,/data.status==='ready'/);
 assert.match(client,/uploadToR2\(file,'acceptance-pdf'\)/);
 assert.doesNotMatch(client,/new FormData/);
 assert.match(client,/\/api\/admin\/settings\/acceptance-letter\/attach/);
 assert.match(attach,/operator\(req,\['super_admin','admin'\]\)/);
 assert.match(attach,/asset.ownerUid!==actor.uid/);
 assert.match(attach,/status!=='ready'/);
 assert.match(pdf,/r2asset:/);
});

test('official PDF storage remains private with legacy reading and public media has an explicit gate',()=>{
 const admin=read('src/app/api/admin/settings/acceptance-letter/upload/route.ts');
 const pdf=read('src/lib/custom-acceptance-pdf.ts');
 const ad=read('src/app/api/admin/ads/media/route.ts');
 const publicImage=read('src/app/api/public/media/[id]/route.ts');
 const permissions=read('src/lib/permissions.ts');
 assert.match(admin,/DIRECT_UPLOAD_REQUIRED/);
 assert.match(pdf,/readInstitutionalObject/);
 assert.match(pdf,/storage\.bucket\(\)\.file/);
 assert.match(ad,/operator\(req,\['super_admin','admin'\]\)/);
 assert.match(ad,/file.ownerUid!==actor.uid/);
 assert.match(ad,/publish!==true/);
 assert.doesNotMatch(publicImage,/arrayBuffer|response.body/);
 assert.match(publicImage,/record\.status!=='active'/);
 assert.match(publicImage,/R2_PUBLIC_MEDIA\.test/);
 assert.match(permissions,/\/api\/admin\/ads/);
});
