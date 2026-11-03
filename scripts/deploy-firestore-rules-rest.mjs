#!/usr/bin/env node
/**
 * Publish the EXACT committed Firestore ruleset using the Firebase Rules REST
 * API. Unlike firebase-tools deploy, this does not inspect the Service Usage
 * API (which our tightly-scoped CI identity cannot access).
 *
 * This never deploys Storage rules or indexes and never accepts rules from a
 * remote URL or a request body. Credentials are read from an ephemeral file.
 */
import {readFileSync} from 'node:fs';
import {createSign,createHash} from 'node:crypto';

const PROJECT='kasa-recruite';
const RELEASE='projects/'+PROJECT+'/releases/cloud.firestore';
const BASE='https://firebaserules.googleapis.com/v1/';
const CREDENTIALS=process.env.GOOGLE_APPLICATION_CREDENTIALS;
const fail=message=>{throw new Error(message);};
if(!CREDENTIALS)fail('GOOGLE_APPLICATION_CREDENTIALS must point to an ephemeral, protected service account file.');
const key=JSON.parse(readFileSync(CREDENTIALS,'utf8'));
if(key.type!=='service_account'||key.project_id!==PROJECT||!key.client_email||!key.private_key)
 fail('Credentials do not belong to the configured KASA production project.');
const config=JSON.parse(readFileSync('firebase.json','utf8'));
if(config.firestore?.rules!=='firestore.rules')
 fail('The complete tracked firestore.rules file must be the configured Firestore rule source.');
const source=readFileSync('firestore.rules','utf8');
if(!source.includes("rules_version = '2';")||
   !source.includes('match /{document=**} { allow read, write: if false; }')||
   !source.includes('match /commissionAdvances/{id} { allow read, write: if false; }'))
 fail('Tracked Firestore rules fail mandatory private-data safeguards. Refusing to publish.');

const b64=object=>Buffer.from(JSON.stringify(object)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const head=b64({alg:'RS256',typ:'JWT'});
const payload=b64({iss:key.client_email,scope:'https://www.googleapis.com/auth/firebase',
  aud:'https://oauth2.googleapis.com/token',iat:now-60,exp:now+3540});
const signer=createSign('RSA-SHA256');
signer.update(head+'.'+payload);
const assertion=head+'.'+payload+'.'+signer.sign(key.private_key,'base64url');
const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{
 method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
 body:new URLSearchParams({'grant_type':'urn:ietf:params:oauth:grant-type:jwt-bearer',
  assertion}).toString()
});
if(!tokenResponse.ok)fail('Google OAuth denied CI service-account authentication (HTTP '+tokenResponse.status+').');
const token=(await tokenResponse.json()).access_token;
if(!token)fail('Google OAuth returned no access token.');
async function api(method,path,body){
 const response=await fetch(BASE+path,{
  method,headers:{Authorization:'Bearer '+token,
   ...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok){
  const message=String(data.error?.message||'').replace(/[\r\n]/g,' ').slice(0,400);
  const error=new Error('Firebase Security Rules API '+method+' failed (HTTP '+
    response.status+'): '+message);
  error.status=response.status;throw error;
 }
 return data;
}
const digest=text=>createHash('sha256').update(text.replace(/\r\n/g,'\n').trimEnd()).digest('hex');
function sourceOf(data){
 const files=data?.source?.files||[];
 const file=files.find(item=>item.name==='firestore.rules')||files.find(item=>item.content?.includes("rules_version = '2';"));
 return typeof file?.content==='string'?file.content:null;
}
let current;
try{current=await api('GET',RELEASE);}
catch(e){if(e.status!==404)throw e;current=null;}
if(current?.rulesetName){
 const old=await api('GET',current.rulesetName);
 if(sourceOf(old)&&digest(sourceOf(old))===digest(source)){
  console.log('KASA Firestore rules are already published, release: '+RELEASE);
  console.log('Rules SHA256: '+digest(source));
  process.exit(0);
 }
}
console.log('Publishing full tracked firestore.rules to '+PROJECT+' default Firestore database.');
const created=await api('POST','projects/'+PROJECT+'/rulesets',{
 source:{files:[{name:'firestore.rules',content:source}]}
});
if(!created.name?.startsWith('projects/'+PROJECT+'/rulesets/'))
 fail('Firebase did not return a valid ruleset name; release left unchanged.');
let result;
if(current){
 result=await api('PATCH',RELEASE,{
  release:{name:RELEASE,rulesetName:created.name},
  updateMask:'rulesetName'
 });
}else{
 result=await api('POST','projects/'+PROJECT+'/releases',{
  name:RELEASE,rulesetName:created.name
 });
}
if(result.rulesetName!==created.name)
 fail('Release update response did not match the published ruleset.');
const verified=await api('GET',RELEASE);
if(verified.rulesetName!==created.name)
 fail('Release verification failed: production does not point to expected ruleset.');
const published=await api('GET',created.name);
if(!sourceOf(published)||digest(sourceOf(published))!==digest(source))
 fail('Remote ruleset content verification failed, investigate production release immediately.');
console.log('Firestore rules successfully published and independently verified.');
console.log('Firebase project: '+PROJECT);
console.log('Release: '+RELEASE);
console.log('Ruleset: '+created.name);
console.log('Rules SHA256: '+digest(source));
