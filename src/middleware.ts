import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {isFirebaseConfigured} from '@/lib/readiness';
/** Admission opening is controlled by Firestore; there is no deployment-variable switch. */
export function middleware(req:NextRequest){
 if(['POST','PUT','PATCH'].includes(req.method)&&/^(?:multipart\/form-data|application\/octet-stream|application\/pdf|image\/)/i.test(req.headers.get('content-type')||''))
  return NextResponse.json({error:'Upload files directly to your authorized external storage.',code:'DIRECT_UPLOAD_REQUIRED'},{status:415,headers:{'Cache-Control':'no-store'}});

 if(['/api/status','/api/public/site','/api/setup/health'].includes(req.nextUrl.pathname))return NextResponse.next();
 if(!isFirebaseConfigured())return NextResponse.json({error:'KASA Firebase configuration is incomplete.'},{status:503,headers:{'Cache-Control':'no-store'}});
 return NextResponse.next();
}
export const config={matcher:['/api/:path*']};
