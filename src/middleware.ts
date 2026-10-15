import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';

/** Return a controlled maintenance response until the Firebase backend is provisioned.
 * No credentials are returned to the browser. The web frontend remains deployable. */
export function middleware(_request:NextRequest){
 const configured=Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_STORAGE_BUCKET);
 if(!configured){
  return NextResponse.json({error:'The KASA enrollment service is being configured. Please try again after setup is complete.'},
   {status:503,headers:{'Cache-Control':'no-store','Retry-After':'3600'}});
 }
 return NextResponse.next();
}
export const config={matcher:['/api/:path*']};
