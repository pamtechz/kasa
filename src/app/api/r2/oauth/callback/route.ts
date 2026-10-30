import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {db} from '@/lib/firebase-admin';
import {OAUTH_COOKIE,oauthStateHash,oauthConfig,exchangeCloudflare,saveOAuthSession} from '@/lib/r2-oauth';
export const runtime='nodejs';
function redirect(url:string,code:string,returnTo='/account'){
 const destination=new URL(returnTo,url);destination.searchParams.set('cloudflare',code);
 const response=NextResponse.redirect(destination);
 response.cookies.set(OAUTH_COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});
 response.headers.set('Cache-Control','no-store');
 return response;
}
export async function GET(req:NextRequest){
 const config=oauthConfig();
 if(!config)return redirect(req.url,'unavailable');
 const uri=new URL(req.url);
 // Never include provider errors or authorization codes in client-facing redirects.
 const state=uri.searchParams.get('state')||'',code=uri.searchParams.get('code')||'';
 const cookie=req.cookies.get(OAUTH_COOKIE)?.value||'';
 if(!/^[A-Za-z0-9_-]{40,64}$/.test(state)||!cookie||state.length!==cookie.length||
    !timingSafeEqual(Buffer.from(state),Buffer.from(cookie)))
  return redirect(req.url,'invalid-state');
 let returnTo='/account';
 const ref=db.collection('r2OAuthStates').doc(oauthStateHash(state));
 try{
  // Single-use and time-bound: consume state before exchanging a provider code.
  const data=await db.runTransaction(async tx=>{
   const snap=await tx.get(ref),d=snap.data();
   if(!d||!d.uid||!d.verifier||Number(d.expiresAt)<Date.now())return null;
   tx.delete(ref);
   return {uid:String(d.uid),verifier:String(d.verifier),returnTo:typeof d.returnTo==='string'?d.returnTo:'/account'};
  });
  if(!data)return redirect(req.url,'expired');
  returnTo=data.returnTo;
  if(uri.searchParams.has('error')||!code||code.length>4096)return redirect(req.url,'cancelled',returnTo);
  const profile=await db.collection('profiles').doc(data.uid).get();
  const guest=data.uid.startsWith('guest_')?(await db.collection('r2GuestSessions').doc(data.uid).get()).data():null;
  if((!profile.exists||profile.data()?.active!==true)&&!(guest&&Number(guest.expiresAt)>Date.now()))return redirect(req.url,'inactive',data.returnTo);
  const tokens=await exchangeCloudflare(config,new URLSearchParams({
   grant_type:'authorization_code',code,redirect_uri:config.redirectUri,code_verifier:data.verifier
  }));
  await saveOAuthSession(data.uid,tokens);
  return redirect(req.url,'connected',data.returnTo);
 }catch{return redirect(req.url,'failed',returnTo);}
}
