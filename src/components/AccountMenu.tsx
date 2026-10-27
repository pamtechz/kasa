'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ChevronDown,LogOut,UserRound} from 'lucide-react';

type AccountMenuProps={
 displayName:string;
 email:string;
 roleLabel:string;
 profileHref?:string;
 onSignOut:()=>void|Promise<void>;
};

/** Hover on desktop; click, keyboard focus and Escape also work on touch devices. */
export function AccountMenu({displayName,email,roleLabel,profileHref,onSignOut}:AccountMenuProps){
 const [open,setOpen]=useState(false);
 return <div className={'kasa-account-menu'+(open?' is-open':'')}
  onMouseLeave={()=>setOpen(false)}
  onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);(e.currentTarget.querySelector('.kasa-account-trigger') as HTMLButtonElement|null)?.focus();}}}>
  <button type="button" className="kasa-account-trigger" aria-label="Open account menu"
   aria-expanded={open} aria-haspopup="true" onClick={()=>setOpen(value=>!value)}>
   <span className="kasa-account-avatar"><UserRound size={19}/></span>
   <ChevronDown size={15} aria-hidden="true"/>
  </button>
  <div className="kasa-account-popover" aria-label="Account and sign out">
   <div className="kasa-account-identity"><span className="kasa-account-avatar"><UserRound size={21}/></span>
    <span><strong>{displayName||'KASA member'}</strong><small>{email}</small></span>
   </div>
   <div className="kasa-account-role">{roleLabel}</div>
   {profileHref&&<Link href={profileHref} className="kasa-account-option" onClick={()=>setOpen(false)}><UserRound size={17}/> My profile</Link>}
   <button type="button" className="kasa-account-option kasa-account-signout" onClick={()=>{setOpen(false);void onSignOut();}}>
    <LogOut size={17}/> Sign out
   </button>
  </div>
 </div>;
}
