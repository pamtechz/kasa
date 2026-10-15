import 'server-only';
import {applicationDefault,cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {getAppCheck} from 'firebase-admin/app-check';
const projectId=process.env.FIREBASE_PROJECT_ID;
const email=process.env.FIREBASE_CLIENT_EMAIL;
const key=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
// Use Application Default Credentials only when explicit credentials are absent.\n// No Firebase requests occur during Next.js static builds; operations still require credentials.
const firebaseAdmin = getApps()[0] ?? initializeApp({
 credential: projectId && email && key ? cert({projectId,clientEmail:email,privateKey:key}) : applicationDefault(),
 storageBucket:process.env.FIREBASE_STORAGE_BUCKET
});
export const adminAuth=getAuth(firebaseAdmin);
export const db=getFirestore(firebaseAdmin);
export const storage=getStorage(firebaseAdmin);
export const appCheck=getAppCheck(firebaseAdmin);
