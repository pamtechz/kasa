const required=[
 'FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY','FIREBASE_STORAGE_BUCKET',
 'NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN','NEXT_PUBLIC_FIREBASE_PROJECT_ID',
 'NEXT_PUBLIC_FIREBASE_APP_ID','NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET','RATE_LIMIT_SALT'
] as const;
export function isFirebaseConfigured(){
 if(!required.every(key=>Boolean(process.env[key]?.trim())))return false;
 if((process.env.RATE_LIMIT_SALT||'').length<32)return false;
 // Development routes bypass server App Check. Production cannot do so.
 if(process.env.NODE_ENV==='production'&&!process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY?.trim())return false;
 const privateKey=(process.env.FIREBASE_PRIVATE_KEY||'').trim().replace(/^"|"$/g,'').replace(/\\n/g,'\n');
 if(!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')||!privateKey.includes('-----END PRIVATE KEY-----')||privateKey.length<1000)return false;
 return process.env.FIREBASE_PROJECT_ID===process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID&&
  process.env.FIREBASE_STORAGE_BUCKET===process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
}
