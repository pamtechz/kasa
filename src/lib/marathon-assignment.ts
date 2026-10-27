import 'server-only';
import {db} from '@/lib/firebase-admin';
import {marathonRoles} from '@/lib/marathon';
import {HttpError} from '@/lib/errors';
import type {Profile} from '@/lib/types';

export function canAssignMarathonTasks(role:string):boolean{
 return ['super_admin','kasaAdmin','kasaOperations'].includes(role);
}
export function validMarathonTaskId(id:string):boolean{
 return /^(T\d{3}|WEB-\d{2}|M-[0-9a-f-]{36})$/.test(id);
}
export async function validateMarathonAssignees(uids:string[]):Promise<void>{
 if(uids.length>20||new Set(uids).size!==uids.length)throw new HttpError(400,'Choose up to 20 distinct members.');
 if(!uids.length)return;
 const snaps=await db.getAll(...uids.map(uid=>db.collection('profiles').doc(uid)));
 for(const snap of snaps){
  const p=snap.data() as Profile|undefined;
  if(!p||p.active!==true||p.role==='student'||
    !(p.role==='super_admin'||(p.marathonAccess?.active===true&&marathonRoles.includes(p.marathonAccess.role)))){
   throw new HttpError(400,'One or more selected members no longer have active Marathon access.');
  }
 }
}
