import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../../src/lib/r2-oauth-errors.ts',import.meta.url),'utf8');
const exports={};
new Function('exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports);
const {oauthCallbackFailure,oauthConnectionError}=exports;

test('OAuth errors are distinct from cancellation and never echo provider-controlled text',()=>{
 for(const [error,result] of Object.entries({access_denied:'access-denied',invalid_scope:'invalid-scope',invalid_client:'invalid-client',unauthorized_client:'unauthorized-client',invalid_request:'invalid-request',unsupported_response_type:'unsupported-response-type',server_error:'provider-unavailable',temporarily_unavailable:'provider-unavailable','':'provider-error','https://untrusted.example/secret':'provider-error'})){
  const params=new URLSearchParams({error,error_description:'private-provider-description',error_uri:'https://untrusted.example/secret',code:'private-code'});
  assert.equal(oauthCallbackFailure(params),result);
  const message=oauthConnectionError(result);
  assert.doesNotMatch(message,/private|untrusted|cancelled/i);
  assert.match(message,/progress is saved/);
 }
 assert.match(oauthConnectionError('invalid-scope'),/invalid_scope/);
 assert.match(oauthConnectionError('unauthorized-client'),/grant types/);
});

test('only a usable code without an OAuth error is eligible for token exchange',()=>{
 assert.equal(oauthCallbackFailure(new URLSearchParams({code:'valid-code'})),null);
 assert.equal(oauthCallbackFailure(new URLSearchParams()),'invalid-response');
 assert.equal(oauthCallbackFailure(new URLSearchParams({code:'x'.repeat(4097)})),'invalid-response');
 assert.equal(oauthCallbackFailure(new URLSearchParams({code:'valid-code',error:'invalid_scope'})),'invalid-scope');
});

test('untrusted result keys and legacy cancellation have safe recoverable copy',()=>{
 for(const key of ['<script>secret</script>','__proto__','constructor']){
  assert.equal(oauthConnectionError(key),'Cloudflare authorization could not be completed. Try connecting again. Your application progress is saved.');
 }
 assert.doesNotMatch(oauthConnectionError('cancelled'),/was cancelled/);
 assert.match(oauthConnectionError('expired'),/expired/);
 assert.match(oauthConnectionError('invalid-state'),/verified/);
});
