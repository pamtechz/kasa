import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {isFirebaseConfigured,isFirebaseReady} from '@/lib/readiness';

export function middleware(req:NextRequest){
 const path=req.nextUrl.pathname;
 if(path==='/api/status'||path==='/api/public/site')return NextResponse.next();
 if(!isFirebaseConfigured()){
  return NextResponse.json({error:'KASA Firebase is not configured. Contact the system administrator.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
 // Staff can configure forms and content before launching public enrollment.
 if(path.startsWith('/api/public/')&&!isFirebaseReady()){
  return NextResponse.json({error:'KASA applications are not yet open.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
 return NextResponse.next();
}
export const config={matcher:['/api/:path*']};
