'use client';
import {getApp,getApps,initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import type {Auth} from 'firebase/auth';
import {getToken, initializeAppCheck, ReCaptchaV3Provider} from 'firebase/app-check';
const config = {
 apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
 authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
 projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
 appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
 storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};
export const firebaseApp = getApps().length ? getApp() : initializeApp(config);
export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
// Never initialize browser Auth while Next.js generates pages on the server.
// Without Firebase env vars, render an explicit setup state rather than crash.
export const auth:Auth = firebaseConfigured && typeof window!=='undefined' ? getAuth(firebaseApp) : (null as unknown as Auth);
let check: ReturnType<typeof initializeAppCheck>|undefined;
export async function appCheckToken(){
  if(typeof window==='undefined' || !process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY) return '';
  if(!check) check=initializeAppCheck(firebaseApp,{provider:new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});
  // The installed modular Firebase App Check SDK exports getToken, not getLimitedUseToken.
  // Standard App Check tokens are verified server-side without one-time consumption.
  return (await getToken(check)).token;
}
export async function authHeaders(){
  if(!auth)throw Error('Firebase Authentication is unavailable in this environment.');
  const user=auth.currentUser;
  if(!user) throw Error('Please sign in first.');
  return {'Authorization':`Bearer ${await user.getIdToken()}`};
}
