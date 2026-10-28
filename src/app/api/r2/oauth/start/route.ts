import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {fail,HttpError} from '@/lib/errors';
import {sameOrigin,rateLimit} from '@/lib/security';
import {storageIdentity} from '@/lib/r2-storage';
import {OAUTH_COOKIE,oauthConfig,oauthRandom,oauthStateHash,oauthChallenge,
 authorizationUrl,oauthStateExpires} from '@/lib/r2-oauth';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  sameOrigin(req);const {uid}=await storageIdentity(req);
  await rateLimit(req,'r2-oauth-start:'+uid,6,15);
  const config=oauthConfig();
  if(!config)throw new HttpError(503,'Cloudflare OAuth is not yet configured by KASA.');
  const state=oauthRandom(),verifier=oauthRandom(),expiresAt=oauthStateExpires();
  await db.collection('r2OAuthStates').doc(oauthStateHash(state)).create({
   uid,verifier,expiresAt,createdAt:new Date().toISOString()
  });
  const res=NextResponse.json({url:authorizationUrl(config,state,oauthChallenge(verifier))},
   {headers:{'Cache-Control':'no-store'}});
  res.cookies.set(OAUTH_COOKIE,state,{httpOnly:true,secure:true,sameSite:'lax',path:'/',
   maxAge:8*60});
  return res;
 }catch(e){return fail(e);}
}
