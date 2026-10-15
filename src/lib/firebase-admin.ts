import 'server-only';
import {cert,getApps,initializeApp,type App} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {getAppCheck} from 'firebase-admin/app-check';

/** Initialize at request time, never while Next.js statically analyzes API routes. */
function adminApp():App{
 const existing=getApps()[0];
 if(existing)return existing;
 const projectId=process.env.FIREBASE_PROJECT_ID;
 const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
 const privateKey=process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/^"|"$/g,'').replace(/\\n/g,'\n');
 if(!projectId||!clientEmail||!privateKey)throw new Error('Firebase Admin service account is not configured');
 return initializeApp({
  credential:cert({projectId,clientEmail,privateKey}),
  storageBucket:process.env.FIREBASE_STORAGE_BUCKET
 });
}
function deferred<T extends object>(get:()=>T):T{
 return new Proxy({} as T,{
  get(_target,property){
   const service=get();
   const value=Reflect.get(service,property);
   return typeof value==='function'?value.bind(service):value;
  }
 });
}
export const adminAuth=deferred(()=>getAuth(adminApp()));
export const db=deferred(()=>getFirestore(adminApp()));
export const storage=deferred(()=>getStorage(adminApp()));
export const appCheck=deferred(()=>getAppCheck(adminApp()));
