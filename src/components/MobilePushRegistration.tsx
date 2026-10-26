'use client';
import {useEffect} from 'react';
import {beforeAuthStateChanged,onIdTokenChanged} from 'firebase/auth';
import {getClientAuth} from '@/lib/firebase-client';

declare global {interface Window {__KASA_FCM_TOKEN?:string}}
/** Flutter supplies a device token, the signed-in website supplies its own ID token.
 * Flutter never receives Firebase credentials or a bearer token.
 */
export function MobilePushRegistration(){
 useEffect(()=>{
  const auth=getClientAuth();
  if(!auth)return;
  let deviceToken=window.__KASA_FCM_TOKEN||'';
  let lastKey='';
  let lastRegisteredAt=0;
  let running=false;
  let pending=false;
  const register=async()=>{
   const user=auth.currentUser;
   if(!deviceToken||!user?.emailVerified)return;
   const key=user.uid+':'+deviceToken;
   if(key===lastKey&&Date.now()-lastRegisteredAt<24*60*60*1000)return;
   if(running){pending=true;return;}
   running=true;
   try{
    const token=await user.getIdToken();
    const res=await fetch('/api/mobile/push-devices',{
     method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
     body:JSON.stringify({token:deviceToken})
    });
    if(res.ok){lastKey=key;lastRegisteredAt=Date.now();}
   }catch{/* Network may be offline; a later page load or token refresh retries. */}
   finally{running=false;if(pending){pending=false;void register();}}
  };
  const onToken=(event:Event)=>{
   const detail=(event as CustomEvent<{token?:string}>).detail;
   if(typeof detail?.token!=='string')return;
   deviceToken=detail.token;
   void register();
  };
  // Unregister when leaving an account; never block a sign-out if offline.
  const stopBefore=beforeAuthStateChanged(auth,async nextUser=>{
   const previous=auth.currentUser;
   if(!previous||previous.uid===nextUser?.uid||!deviceToken)return;
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),1500);
   try{
    const bearer=await previous.getIdToken();
    await fetch('/api/mobile/push-devices',{
     method:'DELETE',headers:{'Content-Type':'application/json',Authorization:'Bearer '+bearer},
     body:JSON.stringify({token:deviceToken}),signal:controller.signal
    });
   }catch{/* Revoked or offline sessions are independently checked server-side. */}
   finally{clearTimeout(timeout);}
   lastKey='';
  });
  const unSub=onIdTokenChanged(auth,()=>{void register();});
  window.addEventListener('kasa:fcm-token',onToken);
  void register();
  return ()=>{stopBefore();unSub();window.removeEventListener('kasa:fcm-token',onToken);};
 },[]);
 return null;
}
