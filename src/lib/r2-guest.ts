import 'server-only';
import {createHash} from 'node:crypto';
import {db} from './firebase-admin';
export const GUEST_STORAGE_COOKIE='__Host-kasa-storage';
export function guestStorageId(secret:string){return 'guest_'+createHash('sha256').update(secret).digest('hex');}
export async function guestStorageIdentity(req:Request):Promise<string|null>{
 const secret=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(GUEST_STORAGE_COOKIE+'='))?.slice(GUEST_STORAGE_COOKIE.length+1)||'';
 if(!/^[A-Za-z0-9_-]{43}$/.test(secret))return null;
 const uid=guestStorageId(secret),session=(await db.collection('r2GuestSessions').doc(uid).get()).data();
 return session&&Number(session.expiresAt)>Date.now()?uid:null;
}
