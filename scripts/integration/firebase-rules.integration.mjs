import test, {before, after} from 'node:test';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {collection, doc, getDoc, getDocs, query, where, setDoc, deleteDoc} from 'firebase/firestore';
import {ref, uploadBytes, getMetadata, deleteObject} from 'firebase/storage';

// These tests operate exclusively against local emulators and a demo project.
const bucketName='gs://demo-kasa-security-ci.appspot.com';
let env;
const bucket=ctx=>ctx.storage(bucketName);

before(async()=>{
 env=await initializeTestEnvironment({
  projectId:'demo-kasa-security-ci',
  firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')},
  storage:{host:'127.0.0.1',port:9199,rules:readFileSync('storage.rules','utf8')}
 });
 await env.clearFirestore();
 await env.clearStorage();
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'profiles/alice'),{role:'student',active:true});
  await setDoc(doc(db,'profiles/staff'),{role:'reviewer',active:true});
  await setDoc(doc(db,'profiles/disabled'),{role:'admin',active:false});
  await setDoc(doc(db,'profiles/agent'),{role:'agent',active:true});
  await setDoc(doc(db,'forms/published'),{published:true,title:'Public form'});
  await setDoc(doc(db,'forms/draft'),{published:false,title:'Draft form'});
  await setDoc(doc(db,'programmes/open'),{published:true});
  await setDoc(doc(db,'announcements/closed'),{published:false});
  await setDoc(doc(db,'adCampaigns/active'),{active:true});
  await setDoc(doc(db,'adCampaigns/paused'),{active:false});
  await setDoc(doc(db,'submissions/app1'),{applicantUid:'alice',status:'accepted'});
  await setDoc(doc(db,'notificationOutbox/private1'),{recipientUid:'alice'});
  await setDoc(doc(db,'settings/intake'),{applicationsOpen:true});
  await setDoc(doc(db,'fundingVerifications/private1'),{amount:100});
  await setDoc(doc(db,'commissionPayments/private1'),{amount:100});
  await uploadBytes(ref(bucket(ctx),'public/brand.png'),new Uint8Array([1,2,3]));
  await uploadBytes(ref(bucket(ctx),'cdf-documents/app1/id.png'),new Uint8Array([1,2,3]));
  await uploadBytes(ref(bucket(ctx),'acceptance-pack/letter.pdf'),new Uint8Array([37,80,68,70,45]));
 });
});
after(async()=>{if(env)await env.cleanup();});

test('only owners can read profiles, and browser writes and collection listing are denied',async()=>{
 const guest=env.unauthenticatedContext().firestore();
 const alice=env.authenticatedContext('alice',{email_verified:true}).firestore();
 const bob=env.authenticatedContext('bob').firestore();
 const staff=env.authenticatedContext('staff',{role:'super_admin'}).firestore();
 await assertFails(getDoc(doc(guest,'profiles/alice')));
 await assertSucceeds(getDoc(doc(alice,'profiles/alice')));
 await assertFails(getDoc(doc(bob,'profiles/alice')));
 await assertFails(getDocs(collection(alice,'profiles')));
 await assertFails(setDoc(doc(alice,'profiles/alice'),{role:'super_admin'}));
 await assertFails(setDoc(doc(staff,'profiles/alice'),{role:'admin'}));
 await assertFails(deleteDoc(doc(alice,'profiles/alice')));
});

test('only published programmes/forms and active campaigns are public; no browser writes',async()=>{
 const guest=env.unauthenticatedContext().firestore();
 const staff=env.authenticatedContext('staff',{email_verified:true}).firestore();
 const agent=env.authenticatedContext('agent',{email_verified:true}).firestore();
 const forged=env.authenticatedContext('outsider',{email_verified:true,role:'super_admin'}).firestore();
 const disabled=env.authenticatedContext('disabled',{email_verified:true}).firestore();
 await assertSucceeds(getDoc(doc(guest,'forms/published')));
 await assertSucceeds(getDoc(doc(staff,'forms/draft')));
 await assertSucceeds(getDocs(collection(staff,'forms')));
 await assertFails(getDoc(doc(agent,'forms/draft')));
 await assertFails(getDoc(doc(forged,'forms/draft')));
 await assertFails(getDoc(doc(disabled,'forms/draft')));
 await assertFails(getDoc(doc(guest,'forms/draft')));
 await assertSucceeds(getDoc(doc(guest,'programmes/open')));
 await assertFails(getDoc(doc(guest,'announcements/closed')));
 await assertSucceeds(getDoc(doc(guest,'adCampaigns/active')));
 await assertFails(getDoc(doc(guest,'adCampaigns/paused')));
 await assertSucceeds(getDocs(query(collection(guest,'forms'),where('published','==',true))));
 await assertFails(getDocs(collection(guest,'forms')));
 await assertFails(setDoc(doc(guest,'forms/published'),{published:true,title:'Forged'}));
});

test('applicants, guests, and claimed administrators cannot read or forge internal records',async()=>{
 for(const ctx of [env.unauthenticatedContext(),env.authenticatedContext('alice',{email_verified:true}),
                   env.authenticatedContext('staff',{email_verified:true}),
                   env.authenticatedContext('agent',{email_verified:true}),
                   env.authenticatedContext('outsider',{email_verified:true,role:'super_admin'})]){
  const db=ctx.firestore();
  for(const path of ['submissions/app1','notificationOutbox/private1','settings/intake',
                     'fundingVerifications/private1','commissionPayments/private1']){
   await assertFails(getDoc(doc(db,path)));
   await assertFails(setDoc(doc(db,path),{status:'approved'}));
  }
  await assertFails(setDoc(doc(db,'submissions/newApplication'),{status:'accepted'}));
  await assertFails(getDocs(collection(db,'submissions')));
 }
});

test('branding can be read but cannot be overwritten or deleted by browsers',async()=>{
 const guest=bucket(env.unauthenticatedContext());
 const alice=bucket(env.authenticatedContext('alice'));
 const staff=bucket(env.authenticatedContext('staff',{role:'super_admin'}));
 await assertSucceeds(getMetadata(ref(guest,'public/brand.png')));
 await assertFails(uploadBytes(ref(guest,'public/forged.png'),new Uint8Array([9])));
 await assertFails(uploadBytes(ref(alice,'public/forged.png'),new Uint8Array([9])));
 await assertFails(deleteObject(ref(staff,'public/brand.png')));
});

test('private CDF evidence and acceptance packs never expose directly through Storage SDK',async()=>{
 for(const ctx of [env.unauthenticatedContext(),env.authenticatedContext('alice'),
                   env.authenticatedContext('staff',{role:'super_admin'})]){
  const storage=bucket(ctx);
  for(const path of ['cdf-documents/app1/id.png','acceptance-pack/letter.pdf']){
   await assertFails(getMetadata(ref(storage,path)));
   await assertFails(uploadBytes(ref(storage,path),new Uint8Array([9])));
  }
 }
});
