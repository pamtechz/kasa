'use client';
import {ChevronDown,ChevronUp} from 'lucide-react';

/** Keep navigation reachable even with a very long permissions-based menu. */
export function SidebarScrollControls({targetSelector}:{targetSelector:string}){
 function scroll(event:React.MouseEvent<HTMLButtonElement>,direction:number){
  const aside=event.currentTarget.closest('aside');
  const target=aside?.querySelector<HTMLElement>(targetSelector);
  if(target)target.scrollBy({top:direction*Math.max(240,target.clientHeight*.75),behavior:'smooth'});
 }
 return <div className="side-scroll-actions" role="group" aria-label="Scroll sidebar navigation">
  <button type="button" onClick={event=>scroll(event,-1)} aria-label="Scroll navigation up" title="Scroll navigation up"><ChevronUp size={18}/></button>
  <button type="button" onClick={event=>scroll(event,1)} aria-label="Scroll navigation down" title="Scroll navigation down"><ChevronDown size={18}/></button>
 </div>;
}
