import {db} from '@/lib/firebase-admin';
import {requireCapability} from '@/lib/security';
import {financeSnapshot} from '@/lib/finance-operations';
import {fail,json} from '@/lib/errors';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  await requireCapability(req,'finance.read');
  const items:Array<{id:string;reference:string;student:string;fundingMethod:string;status:string;flags:ReturnType<typeof financeSnapshot>['flags'];balanceMinor:number|null}>=[];
  let cursor:FirebaseFirestore.QueryDocumentSnapshot|undefined,partial=false,scanned=0;
  for(let page=0;page<40;page++){
   let query=db.collection('submissions').where('formKind','==','student').orderBy('__name__').limit(250);
   if(cursor)query=query.startAfter(cursor);
   const snap=await query.get();scanned+=snap.size;
   for(const doc of snap.docs){
    const app=doc.data(),snapshot=financeSnapshot(app);
    if(!snapshot.flags.length)continue;
    items.push({id:doc.id,reference:String(app.reference||doc.id),
     student:String(app.answers?.['full-name']||app.answers?.fullNames||'Student'),
     fundingMethod:String(app.fundingMethod||'self_funded'),status:String(app.status||'submitted'),
     flags:snapshot.flags,balanceMinor:snapshot.balanceMinor});
   }
   if(snap.size<250)break;
   cursor=snap.docs[snap.docs.length-1];if(page===39)partial=true;
  }
  items.sort((a,b)=>Number(b.flags.some(f=>f.level==='critical'))-Number(a.flags.some(f=>f.level==='critical'))||
   a.reference.localeCompare(b.reference));
  return json({items,summary:{totalItems:items.length,critical:items.filter(x=>x.flags.some(f=>f.level==='critical')).length,scanned,partial},
   note:'This queue summarizes application-level issues. Individual historical payment receipt differences require opening the student fee statement; no records were changed.'});
 }catch(e){return fail(e);}
}
