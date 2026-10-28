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
