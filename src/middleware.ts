import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {isFirebaseReady} from '@/lib/readiness';
/** Application APIs fail closed until all required backend configuration is supplied. */
export function middleware(req:NextRequest){
 if(req.nextUrl.pathname==='/api/status')return NextResponse.next();
 if(!isFirebaseReady()){
  return NextResponse.json({error:'KASA applications are not yet open. Backend configuration is in progress.'},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'3600'}});
 }
 return NextResponse.next();
}
export const config={matcher:['/api/:path*']};
