import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
const {FIREBASE_PROJECT_ID,FIREBASE_CLIENT_EMAIL,FIREBASE_PRIVATE_KEY,FIREBASE_STORAGE_BUCKET}=process.env;
if(!FIREBASE_PROJECT_ID||!FIREBASE_CLIENT_EMAIL||!FIREBASE_PRIVATE_KEY)throw Error('Set server-side Firebase env vars before running this script.');
const app=initializeApp({credential:cert({projectId:FIREBASE_PROJECT_ID,clientEmail:FIREBASE_CLIENT_EMAIL,privateKey:FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')}),storageBucket:FIREBASE_STORAGE_BUCKET});
export const db=getFirestore(app),auth=getAuth(app);
