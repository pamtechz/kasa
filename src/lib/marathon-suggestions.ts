import 'server-only';
import {FieldPath} from 'firebase-admin/firestore';
import {db} from '@/lib/firebase-admin';
import {HttpError} from '@/lib/errors';
import type {MarathonIdentity} from '@/lib/marathon';
import {canReview} from '@/lib/marathon';

const PAGE_SIZE=50;
export async function marathonSuggestionsPage(identity:MarathonIdentity,status='pending',cursor:string|null=null){
 if(!['pending','accepted','rejected','all'].includes(status))throw new HttpError(400,'Invalid recommendation status.');
 if(cursor&&(!/^[A-Za-z0-9_-]{1,150}$/.test(cursor)))throw new HttpError(400,'Invalid recommendation cursor.');
 // Document-ID ordering provides stable cursor pagination without a new
 // composite index. Readers can only ever query their own recommendations.
 let query=db.collection('marathonSuggestions').orderBy(FieldPath.documentId());
 if(canReview(identity.role)){
  if(status!=='all')query=query.where('status','==',status);
 }else query=query.where('createdBy','==',identity.uid);
 if(cursor)query=query.startAfter(cursor);
 const snap=await query.limit(PAGE_SIZE+1).get();
 const docs=snap.docs.slice(0,PAGE_SIZE);
 return {
  suggestions:docs.map(d=>({...d.data(),id:d.id})),
  nextSuggestionCursor:snap.size>PAGE_SIZE?docs[docs.length-1].id:null
 };
}
