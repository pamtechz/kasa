/** Shared, server-side readiness gate for the KASA Firebase application. */
const requiredKeys=[
 'FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY','FIREBASE_STORAGE_BUCKET',
 'NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN','NEXT_PUBLIC_FIREBASE_PROJECT_ID',
 'NEXT_PUBLIC_FIREBASE_APP_ID','NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET','NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY',
 'RATE_LIMIT_SALT'
] as const;
export function isFirebaseReady():boolean {
 // Production applications only open after an explicit security and admissions sign-off.
 if(process.env.KASA_APPLICATIONS_ENABLED!=='true')return false;
 if(!requiredKeys.every(key=>Boolean(process.env[key]?.trim())))return false;
 if((process.env.RATE_LIMIT_SALT||'').length<32)return false;
 return process.env.FIREBASE_PROJECT_ID===process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  && process.env.FIREBASE_STORAGE_BUCKET===process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
}
