import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
function transpile(path,stubs){
 const exports={};
 const code=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',code)(name=>Object.hasOwn(stubs,name)?stubs[name]:require(name),exports);
 return exports;
}
test('Cloudflare authorization uses PKCE S256, state, fixed callback and strict OAuth config',()=>{
 const src=read('src/lib/r2-oauth.ts');
 assert.match(src,/code_challenge_method:'S256'/);
 assert.match(src,/redirectUri=process\.env\.CLOUDFLARE_OAUTH_REDIRECT_URI/);
 assert.match(src,/url\.protocol!=='https:'|url\.protocol !== 'https:'/);
 assert.match(src,/createHash\('sha256'\)/);
 assert.match(src,/CLOUDFLARE_OAUTH_CLIENT_SECRET/);
 assert.match(src,/r2EncryptionReady\(\)/);
 const start=read('src/app/api/r2/oauth/start/route.ts');
 assert.match(start,/storageIdentity\(req\)/);
 assert.match(start,/sameOrigin\(req\)/);
 assert.match(start,/httpOnly:true,secure:true,sameSite:'lax'/);
 assert.match(start,/rateLimit/);
});
test('one-time cookie-bound OAuth callback does not allow replay or expose codes in URLs',()=>{
 const callback=read('src/app/api/r2/oauth/callback/route.ts');
 assert.match(callback,/timingSafeEqual/);
 assert.match(callback,/tx\.delete\(ref\)/);
 assert.match(callback,/exchangeCloudflare/);
 assert.match(callback,/saveOAuthSession/);
 assert.doesNotMatch(callback,/searchParams\.set\('code'/);
});
test('Cloudflare tokens are only encrypted on the server; bucket selection verifies membership',()=>{
 const src=read('src/lib/r2-oauth.ts');
 const select=read('src/app/api/r2/oauth/select/route.ts');
 assert.match(src,/encryptR2Secrets\('cloudflare-oauth:'\+uid/);
 assert.match(src,/decryptR2Secrets\('cloudflare-oauth:'\+uid/);
 assert.match(select,/cloudflareAccounts\(uid\)/);
 assert.match(select,/cloudflareApi\(uid/);
 assert.match(select,/tx\.update\(ref/);
 const rules=read('firestore.rules');
 for(const collection of ['r2OAuthStates','r2OAuthSessions','r2OAuthSecrets'])
  assert.match(rules,new RegExp('match /'+collection+'/'));
});
test('OAuth URL generation requests exact configured scopes without guessing Cloudflare permissions',()=>{
 const mod=transpile('src/lib/r2-oauth.ts',{
  'server-only':{},
  'node:crypto':require('node:crypto'),
  './firebase-admin':{db:{}},
  './errors':{HttpError:class extends Error{}},
  './r2-crypto':{encryptR2Secrets(){},decryptR2Secrets(){},r2EncryptionReady:()=>true}
 });
 const url=new URL(mod.authorizationUrl({clientId:'test-client',clientSecret:'fake',
  redirectUri:'https://kasaschool.vercel.app/api/r2/oauth/callback',scopes:'account.read custom.scope'},
  'state-value','test-challenge'));
 assert.equal(url.origin,'https://dash.cloudflare.com');
 assert.equal(url.pathname,'/oauth2/auth');
 assert.equal(url.searchParams.get('scope'),'account.read custom.scope');
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.equal(url.searchParams.get('state'),'state-value');
});

test('shared OAuth connection UI requires no pasted credentials and auto-provisions a private bucket',()=>{
 const panel=read('src/components/R2StoragePanel.tsx');
 const connect=read('src/components/ExternalStorageConnection.tsx');
 const provision=read('src/app/api/r2/oauth/provision/route.ts');
 assert.match(panel,/ExternalStorageConnection/);assert.doesNotMatch(panel,/secretAccessKey|platformAvailable|showAdvanced/);
 assert.match(connect,/Connect with Cloudflare/);assert.match(connect,/oauth\/provision/);
 assert.match(provision,/accounts.length>1/);assert.match(provision,/prepareOAuthBucket/);
});
test('OAuth object upload proxy is disabled and direct scoped token provisioning replaces it',()=>{
 const up=read('src/app/api/r2/oauth/upload/route.ts');
 const direct=read('src/lib/r2-oauth-direct.ts');
 assert.match(up,/DIRECT_UPLOAD_REQUIRED/);assert.doesNotMatch(up,/formData|arrayBuffer/);
 assert.match(direct,/expires_on/);assert.match(direct,/Workers R2 Storage Bucket Item Write/);
 assert.match(direct,/com.cloudflare.edge.r2.bucket/);assert.match(direct,/encryptR2Secrets/);
 assert.doesNotMatch(direct,/new FormData/);
});


test('Cloudflare OAuth configuration rejects placeholder scopes and mismatched callback hosts',()=>{
 const mod=transpile('src/lib/r2-oauth.ts',{
  'server-only':{},'node:crypto':require('node:crypto'),
  './firebase-admin':{db:{}},'./errors':{HttpError:class extends Error{}},
  './r2-crypto':{encryptR2Secrets(){},decryptR2Secrets(){},r2EncryptionReady:()=>true}
 });
 assert.equal(mod.oauthScopeFormatValid('account discovery R2 token-provisioning permissions'),false);
 assert.equal(mod.oauthScopeFormatValid('account.read workers.r2.write account_api_tokens.create offline_access'),true);
 assert.equal(mod.oauthScopeFormatValid('account_api_tokens:create workers.r2.write'),false);
 const saved={};
 for(const key of ['CLOUDFLARE_OAUTH_CLIENT_ID','CLOUDFLARE_OAUTH_CLIENT_SECRET','CLOUDFLARE_OAUTH_SCOPES','CLOUDFLARE_OAUTH_REDIRECT_URI','APP_URL','VERCEL_URL','VERCEL_BRANCH_URL'])
  saved[key]=process.env[key];
 try{
  process.env.CLOUDFLARE_OAUTH_CLIENT_ID='fixture-id';
  process.env.CLOUDFLARE_OAUTH_CLIENT_SECRET='fixture-secret';
  process.env.CLOUDFLARE_OAUTH_SCOPES='account discovery R2 token-provisioning permissions';
  process.env.CLOUDFLARE_OAUTH_REDIRECT_URI='https://kasaschool.vercel.app/api/r2/oauth/callback';
  process.env.APP_URL='https://kasaschool.vercel.app';
  delete process.env.VERCEL_URL;
  assert.equal(mod.oauthConfig(),null);
  assert.equal(mod.oauthReadiness('https://kasaschool.vercel.app/api/r2/oauth/readiness').code,'invalid-scopes');
  process.env.CLOUDFLARE_OAUTH_SCOPES='account.read workers.r2.write account_api_tokens.create offline_access';
  assert.equal(mod.oauthReadiness('https://kasa-preview.vercel.app/api/r2/oauth/readiness').code,'callback-host-mismatch');
  assert.equal(mod.oauthReadiness('https://kasaschool.vercel.app/api/r2/oauth/readiness').available,true);
  process.env.VERCEL_BRANCH_URL='kasa-preview.vercel.app';
  process.env.CLOUDFLARE_OAUTH_REDIRECT_URI='https://kasa-preview.vercel.app/api/r2/oauth/callback';
  assert.equal(mod.oauthReadiness('https://kasa-preview.vercel.app/api/r2/oauth/readiness').available,true);
 }finally{
  for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 }
});

test('readiness is public and non-secret and protects guests from broken OAuth setup',()=>{
 const route=read('src/app/api/r2/oauth/readiness/route.ts');
 const start=read('src/app/api/r2/oauth/start/route.ts');
 const client=read('src/lib/r2-upload-client.ts');
 const panel=read('src/components/ExternalStorageConnection.tsx');
 assert.match(route,/oauthReadiness\(req.url\)/);
 assert.doesNotMatch(route,/storageIdentity|clientSecret|accessKeyId/);
 assert.match(start,/oauthReadiness\(req.url\)/);
 assert.match(client,/\/api\/r2\/oauth\/readiness/);
 assert.match(panel,/setAvailable\(readiness.available\)/);
 assert.match(panel,/disabled=\{!available\}/);
});


test('disconnect disables issuance, revokes provider tokens before clearing local secrets and warns on incomplete provider revocation',async()=>{
 const route=read('src/app/api/r2/oauth/disconnect/route.ts');
 assert.match(route,/status:'disconnecting'/);
 assert.match(route,/revokeOAuthIssuedToken\(uid,connection.id/);
 assert.match(route,/tx\.delete\(sessionRef\)/);
 assert.match(route,/tx\.delete\(db\.collection\('r2OAuthSecrets'\)/);
 assert.match(route,/tokensNeedingProviderRevocation/);
 assert.match(route,/providerRevocationConfirmed/);
 const ui=read('src/components/ExternalStorageConnection.tsx');
 assert.match(ui,/setDisconnectNotice\(result.message\)/);
 const direct=read('src/lib/r2-oauth-direct.ts');
 assert.match(direct,/revokeOAuthIssuedToken/);
 assert.match(direct,/method:'DELETE'/);
 assert.match(direct,/stored.ownerUid!==uid/);
 assert.match(direct,/response.status===404\|\|response.status===410/);
});
test('provider token revocation deletes only owned encrypted KASA-issued tokens and tolerates already-deleted tokens',async t=>{
 const accountId='a'.repeat(32),tokenId='b'.repeat(32);
 const connectionId='01234567-89ab-4cde-8fab-0123456789ab';
 let ownerUid='owner';
 const db={collection:name=>({doc:()=>({get:async()=>({data:()=>name==='r2ConnectionSecrets'?{ownerUid,encrypted:'ciphertext'}:null})})})};
 const direct=transpile('src/lib/r2-oauth-direct.ts',{
  'server-only':{},
  'node:crypto':require('node:crypto'),
  './firebase-admin':{db},
  './errors':{HttpError:class extends Error{}},
  './r2-oauth':{cloudflareBearer:async()=> 'test-oauth',CLOUD_API:'https://api.cloudflare.com/client/v4',cloudflareApi:async()=>{}},
  './r2-crypto':{encryptR2Secrets(){},decryptR2Secrets:()=>({accessKeyId:tokenId,secretAccessKey:'not-exposed'})},
  './r2-signing':{validateR2Address:()=>{}}
 });
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,opts)=>{
  calls.push({url,method:opts.method,authorization:opts.headers.Authorization});
  return Response.json({success:true});
 });
 assert.equal(await direct.revokeOAuthIssuedToken('owner',connectionId,accountId),true);
 assert.deepEqual(calls,[{url:'https://api.cloudflare.com/client/v4/accounts/'+accountId+'/tokens/'+tokenId,method:'DELETE',authorization:'Bearer test-oauth'}]);
 ownerUid='other';
 assert.equal(await direct.revokeOAuthIssuedToken('owner',connectionId,accountId),false);
 assert.equal(calls.length,1);
 ownerUid='owner';
 globalThis.fetch=async()=>new Response(null,{status:404});
 assert.equal(await direct.revokeOAuthIssuedToken('owner',connectionId,accountId),true);
});


test('live storage diagnostic is strictly owner-scoped, read-only and does not upload files',()=>{
 const route=read('src/app/api/r2/oauth/diagnose/route.ts');
 const ui=read('src/components/ExternalStorageConnection.tsx');
 assert.match(route,/storageIdentity\(req\)/);
 assert.match(route,/sameOrigin\(req\)/);
 assert.match(route,/rateLimit\(req/);
 assert.match(route,/connection.ownerUid!==uid/);
 assert.match(route,/connection.auth!=='oauth'/);
 assert.match(route,/resolveR2\(uid,id\)/);
 assert.match(route,/signR2Url\(bucket,'HEAD'/);
 assert.match(route,/response.status===404/);
 assert.doesNotMatch(route,/method:'PUT'|arrayBuffer\(|FormData|body:file/);
 assert.match(ui,/Test storage/);
 assert.match(ui,/\/api\/r2\/oauth\/diagnose/);
});


test('first-time guest sees disconnected status rather than a 401 before storage consent',async()=>{
 const src=read('src/app/api/r2/oauth/route.ts');
 assert.match(src,/!req\.headers\.get\('authorization'\)/);
 assert.match(src,/guestStorageIdentity\(req\)/);
 assert.match(src,/connected:false,connectionId:null,selectedBucket:null/);
 assert.match(src,/storageIdentity\(req\)/);
});

test('preview same-origin policy allows exact configured callback and stable branch host without trusting arbitrary origins',()=>{
 const source=read('src/lib/security.ts');
 assert.match(source,/CLOUDFLARE_OAUTH_REDIRECT_URI/);
 assert.match(source,/VERCEL_BRANCH_URL/);
 const mod=transpile('src/lib/security.ts',{
  'server-only':{},'node:crypto':require('node:crypto'),
  './firebase-admin':{adminAuth:{},db:{}},'./errors':{HttpError:class HttpError extends Error{constructor(status,message){super(message);this.status=status}}},
  './permissions':{can:()=>false,routeCapability:()=>null},
  './provisioned-sign-in':{canUseUnverifiedProvisionedAccount:()=>false}
 });
 const saved={};
 for(const key of ['NODE_ENV','APP_URL','VERCEL_URL','VERCEL_BRANCH_URL','CLOUDFLARE_OAUTH_REDIRECT_URI'])saved[key]=process.env[key];
 try{
  process.env.NODE_ENV='production';
  process.env.APP_URL='https://kasaschool.vercel.app';
  process.env.VERCEL_URL='kasa-unique-build.vercel.app';
  delete process.env.VERCEL_BRANCH_URL;
  process.env.CLOUDFLARE_OAUTH_REDIRECT_URI='https://kasa-git-feature.vercel.app/api/r2/oauth/callback';
  const check=origin=>mod.sameOrigin(new Request('https://kasa-git-feature.vercel.app/api/r2/guest',{method:'POST',headers:{origin}}));
  assert.doesNotThrow(()=>check('https://kasa-git-feature.vercel.app'));
  assert.throws(()=>check('https://attacker.example'),/Invalid request origin/);
  assert.doesNotThrow(()=>check('https://kasaschool.vercel.app'));
  delete process.env.CLOUDFLARE_OAUTH_REDIRECT_URI;
  process.env.VERCEL_BRANCH_URL='kasa-git-feature.vercel.app';
  assert.doesNotThrow(()=>check('https://kasa-git-feature.vercel.app'));
 }finally{for(const [key,v] of Object.entries(saved)){if(v===undefined)delete process.env[key];else process.env[key]=v;}}
});

test('missing App Check token blocks guest session and file control traffic on the client without skipping enforcement',async t=>{
 const client=transpile('src/lib/r2-upload-client.ts',{
  './firebase-client':{getClientAuth:()=>({currentUser:null}),appCheckToken:async()=>''}
 });
 let called=0;
 t.mock.method(globalThis,'fetch',async()=>{called++;throw Error('must not contact server');});
 await assert.rejects(()=>client.storageJson('/api/r2/guest',{},true),/application verification is not configured/);
 assert.equal(called,0);
 const code=read('src/lib/r2-upload-client.ts');
 assert.match(code,/authStateReady/);
 assert.match(code,/if\(attest&&!token\)/);
});
