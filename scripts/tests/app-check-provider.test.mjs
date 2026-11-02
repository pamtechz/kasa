import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../../src/lib/firebase-client.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

test('App Check uses the registered Enterprise key, refreshes tokens and fails closed',async()=>{
 const keys=['API_KEY','AUTH_DOMAIN','PROJECT_ID','APP_ID','STORAGE_BUCKET','APPCHECK_SITE_KEY'].map(k=>'NEXT_PUBLIC_FIREBASE_'+k);
 const saved=new Map(keys.map(k=>[k,process.env[k]]));
 const savedWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
 const originalWarn=console.warn;
 let initializations=0,tokenRequests=0,fail=false;
 const siteKey='6L'+'a'.repeat(38);
 class EnterpriseProvider{constructor(key){this.siteKey=key;}}
 const stubs={
  'firebase/app':{getApps:()=>[],initializeApp:()=>({name:'kasa'}),getApp:()=>({name:'kasa'})},
  'firebase/auth':{getAuth:()=>({}),signOut:async()=>{}},
  'firebase/app-check':{
   ReCaptchaEnterpriseProvider:EnterpriseProvider,
   initializeAppCheck:(_app,options)=>{
    initializations++;
    assert.ok(options.provider instanceof EnterpriseProvider);
    assert.equal(options.provider.siteKey,siteKey);
    assert.equal(options.isTokenAutoRefreshEnabled,true);
    return {};
   },
   getToken:async(_check,forceRefresh)=>{
    tokenRequests++;
    assert.equal(forceRefresh,false);
    if(fail)throw Error('attestation rejected');
    return {token:'verified-test-token'};
   }
  }
 };
 try{
  for(const key of keys)process.env[key]='test-setting';
  process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=siteKey;
  Object.defineProperty(globalThis,'window',{value:{},configurable:true});
  console.warn=()=>{};
  const exports={};
  new Function('require','exports',code)(name=>{
   assert.ok(Object.hasOwn(stubs,name),'unexpected module '+name);
   return stubs[name];
  },exports);
  assert.equal(await exports.appCheckToken(),'verified-test-token');
  assert.equal(await exports.appCheckToken(),'verified-test-token');
  assert.equal(initializations,1);
  fail=true;
  assert.equal(await exports.appCheckToken(),'');
  for(const invalid of ['', 'ccccccccccccccccccccccccc', 'placeholder']){
   process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=invalid;
   assert.equal(await exports.appCheckToken(),'');
  }
  assert.equal(initializations,1);
  assert.equal(tokenRequests,3);
 }finally{
  console.warn=originalWarn;
  for(const [key,value] of saved)if(value===undefined)delete process.env[key];else process.env[key]=value;
  if(savedWindow)Object.defineProperty(globalThis,'window',savedWindow);else delete globalThis.window;
 }
});
