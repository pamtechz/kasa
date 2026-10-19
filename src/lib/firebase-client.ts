'use client';
import {getApp,getApps,initializeApp} from 'firebase/app';
import type {FirebaseApp} from 'firebase/app';
import {getAuth,signOut} from 'firebase/auth';
import type {Auth} from 'firebase/auth';
import {getToken,initializeAppCheck,ReCaptchaV3Provider} from 'firebase/app-check';

// Keep literal NEXT_PUBLIC_ references. Next.js substitutes these browser
// variables at build time; dynamic process.env[key] reads cannot be inlined.
const config={
 apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
 authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
 projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
 appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
 storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
};
export const missingFirebaseBrowserSettings=[
 ...(!config.apiKey?['NEXT_PUBLIC_FIREBASE_API_KEY']:[]),
 ...(!config.authDomain?['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN']:[]),
 ...(!config.projectId?['NEXT_PUBLIC_FIREBASE_PROJECT_ID']:[]),
 ...(!config.appId?['NEXT_PUBLIC_FIREBASE_APP_ID']:[]),
 ...(!config.storageBucket?['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET']:[])
] as const;
export const firebaseConfigured=missingFirebaseBrowserSettings.length===0;

// Never create a partially configured default Firebase app. In particular,
// variables added to Vercel do not exist in the developer's local .env.local.
export const firebaseApp:FirebaseApp|null=firebaseConfigured
 ?(getApps().length?getApp():initializeApp(config))
 :null;
// Browser-only service: SSR renders the same logged-out shell as hydration.
export const auth:Auth|null=firebaseApp&&typeof window!=='undefined'
 ?getAuth(firebaseApp):null;

export function getClientAuth():Auth|null{
 if(typeof window==='undefined'||!firebaseConfigured)return null;
 const app=firebaseApp||(getApps().length?getApp():initializeApp(config));
 return getAuth(app);
}

let check:ReturnType<typeof initializeAppCheck>|undefined;
export async function appCheckToken(){
 const siteKey=process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
 if(!firebaseApp||typeof window==='undefined'||!siteKey)return '';
 if(!check)check=initializeAppCheck(firebaseApp,{
  provider:new ReCaptchaV3Provider(siteKey),isTokenAutoRefreshEnabled:true
 });
 return (await getToken(check)).token;
}
export async function authHeaders(){
 const a=getClientAuth()||auth;
 if(!a)throw Error('Firebase Authentication is unavailable. Check the local Firebase web-app settings and restart the dev server.');
 const user=a.currentUser;
 if(!user)throw Error('Please sign in first.');
 return {Authorization:`Bearer ${await user.getIdToken()}`};
}
export function requireClientAuth():Auth{
 const a=getClientAuth()||auth;
 if(!a)throw Error('Firebase Authentication is unavailable. Configure NEXT_PUBLIC_FIREBASE_* in .env.local and restart npm run dev.');
 return a;
}
export async function signOutClient():Promise<void>{
 if(!auth)return; const a=getClientAuth()||auth;
 await signOut(a);
}

