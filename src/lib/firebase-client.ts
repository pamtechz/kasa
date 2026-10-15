'use client';
import {getApp,getApps,initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getLimitedUseToken, initializeAppCheck, ReCaptchaV3Provider} from 'firebase/app-check';
const config = {
 apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
 authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
 projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
 appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
 storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};
export const firebaseApp = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(firebaseApp);
let check: ReturnType<typeof initializeAppCheck>|undefined;
export async function appCheckToken(){
  if(typeof window==='undefined' || !process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY) return '';
  if(!check) check=initializeAppCheck(firebaseApp,{provider:new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});
  return (await getLimitedUseToken(check)).token;
}
export async function authHeaders(){
  const user=auth.currentUser;
  if(!user) throw Error('Please sign in first.');
  return {'Authorization':`Bearer ${await user.getIdToken()}`};
}
