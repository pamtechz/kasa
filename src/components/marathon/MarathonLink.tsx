'use client';
import Link from 'next/link';
import type {ComponentProps} from 'react';
import {isMarathonWorkspacePath} from '@/lib/marathon-navigation';

type Props=Omit<ComponentProps<typeof Link>,'href'|'onNavigate'>&{href:string};

export function MarathonLink({href,replace=false,scroll=true,...props}:Props){
 const localView=isMarathonWorkspacePath(href);
 return <Link {...props} href={href} replace={replace} scroll={scroll} prefetch={localView?false:props.prefetch} onNavigate={event=>{
  if(!localView)return;
  event.preventDefault();
  // These views share one mounted workspace; no server page payload is needed.
  if(href!==window.location.pathname+window.location.search+window.location.hash){
   if(replace)window.history.replaceState(null,'',href);
   else window.history.pushState(null,'',href);
  }
  if(scroll)window.scrollTo({top:0,behavior:'auto'});
 }}/>;
}
