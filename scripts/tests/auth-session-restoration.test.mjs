import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../src/lib/firebase-client.ts',import.meta.url),'utf8');
const start=source.indexOf('export async function authHeaders(){')+'export async function authHeaders(){'.length;
const body=source.slice(start,source.indexOf('\nexport function requireClientAuth',start)).trim().replace(/\}$/, '');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const headers=new AsyncFunction('getClientAuth','auth',body);
test('a null initial user is restored before checking sign-in or requesting a token',async()=>{
 let ready=false,tokenRequested=false;
 const auth={currentUser:null,async authStateReady(){
  await Promise.resolve();ready=true;
  this.currentUser={async getIdToken(){assert.equal(ready,true);tokenRequested=true;return 'test-token';}};
 }};
 assert.deepEqual(await headers(()=>auth,null),{Authorization:'Bearer test-token'});
 assert.equal(tokenRequested,true);
});
test('a signed-out session still fails closed after restoration settles',async()=>{
 let restored=false;
 const auth={currentUser:null,async authStateReady(){restored=true;}};
 await assert.rejects(headers(()=>auth,null),/Please sign in first/);
 assert.equal(restored,true);
});
test('missing configuration and failed token refresh never create an authenticated header',async()=>{
 await assert.rejects(headers(()=>null,null),/Authentication is unavailable/);
 const auth={currentUser:{async getIdToken(){throw Error('Token refresh failed');}},async authStateReady(){}};
 await assert.rejects(headers(()=>auth,null),/Token refresh failed/);
});
