'use client';
import {useEffect} from 'react';
export function MarathonOfflineWorker(){
 useEffect(()=>{
  if(!('serviceWorker' in navigator)||location.protocol!=='https:')return;
  void navigator.serviceWorker.register('/marthon-sw.js',{scope:'/marathon'}).catch(()=>{
   // Offline mode remains limited to the currently open page if registration fails.
  });
 },[]);
 return null;
}
