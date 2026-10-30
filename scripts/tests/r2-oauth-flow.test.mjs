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
