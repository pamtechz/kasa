#!/usr/bin/env node
/**
 * Diagnoses whether this local Next.js process has the names of required
 * environment variables. No credential values or keys are printed.
 *
 * Run through `npm run doctor:firebase`, which loads .env.local via Node 22.
 */
const web=[
 'NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
 'NEXT_PUBLIC_FIREBASE_PROJECT_ID','NEXT_PUBLIC_FIREBASE_APP_ID',
 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET','NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY'
];
const server=[
 'FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY',
 'FIREBASE_STORAGE_BUCKET','RATE_LIMIT_SALT','BOOTSTRAP_ADMIN_EMAIL'
];
function report(title,keys){
 console.log('\n'+title);
 for(const name of keys)console.log('  '+(process.env[name]?.trim()?'[configured] ':'[MISSING] ')+name);
}
console.log('KASA local Firebase environment diagnostics (variable names only; no values are printed).');
report('Browser/web app configuration:',web);
report('Server/administrative configuration:',server);
const missing=web.filter(name=>!process.env[name]?.trim());
if(missing.length){
 console.error('\nLocal browser login cannot initialize: '+missing.length+' required web-app setting(s) are missing.');
 console.error('Copy .env.example to .env.local, fill values from Firebase Console -> Project settings -> Your apps -> Web app, and restart npm run dev.');
 process.exitCode=1;
}else{
 console.log('\nAll browser web-app keys are present in this local process.');
 console.log('This checks configuration presence only; it does not test Firebase Authentication or Firestore permissions.');
}
if(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID&&process.env.FIREBASE_PROJECT_ID&&
 process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==process.env.FIREBASE_PROJECT_ID){
 console.error('WARNING: Browser and server Firebase project IDs do not match.');
 process.exitCode=1;
}
if(process.env.RATE_LIMIT_SALT&&process.env.RATE_LIMIT_SALT.length<32){
 console.error('WARNING: RATE_LIMIT_SALT must contain at least 32 characters.');
 process.exitCode=1;
}
console.log('No Vercel deployment was requested.');
