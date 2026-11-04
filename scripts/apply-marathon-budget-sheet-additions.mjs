import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore,FieldPath} from 'firebase-admin/firestore';
import {getMessaging} from 'firebase-admin/messaging';
const source=JSON.parse(readFileSync('src/data/marathon-budget-sheet-additions-20261104.json','utf8'));
const mode=process.argv[2];
if(!['--dry-run','--apply'].includes(mode))throw Error('Choose --dry-run or --apply.');
if(source.firebaseProjectId!=='kasa-recruite'||source.eventId!=='kasa-life-2027-march'||source.rows.length!==2)
 throw Error('Unexpected import scope.');
const sha=createHash('sha256').update(JSON.stringify(source)).digest('hex');
const normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
const identity=r=>normalize(r.category)+'|'+normalize(r.description);
for(const r of source.rows){
 if(![r.quantity,r.unitCostMinor,r.months,r.plannedMinor,r.actualPaidMinor].every(Number.isSafeInteger)||
  r.quantity<1||r.months<1||r.quantity*r.unitCostMinor*r.months!==r.plannedMinor||r.actualPaidMinor<0||r.actualPaidMinor>r.plannedMinor||r.status!=='approved')throw Error('Invalid source amount or approval.');
}
const account=JSON.parse(process.env.KASA_FIREBASE_SERVICE_ACCOUNT_JSON||'null');
if(account?.project_id!==source.firebaseProjectId||account.type!=='service_account')throw Error('Incorrect Firebase project credential.');
const app=initializeApp({credential:cert(account),projectId:source.firebaseProjectId}),db=getFirestore(app);
const eventRef=db.collection('marathonEvents').doc(source.eventId);
const importRef=db.collection('marathonBudgetImports').doc(source.importId);
const noticeRef=eventRef.collection('notices').doc(source.importId);
const members=[];let cursor;
for(;;){
 let query=db.collection('profiles').orderBy(FieldPath.documentId()).limit(250);if(cursor)query=query.startAfter(cursor);
 const page=await query.get();
 for(const d of page.docs){const p=d.data();if(p.active===true&&p.role!=='student'&&(p.role==='super_admin'||p.marathonAccess?.active===true&&['kasaAdmin','kasaOperations','kasaEditor','kasaReviewer','kasaClient'].includes(p.marathonAccess.role)))members.push(d.id);}
 if(page.size<250)break;cursor=page.docs.at(-1).id;
}
const now=new Date().toISOString();
const outcome=await db.runTransaction(async tx=>{
 const [event,existing,record]=await Promise.all([tx.get(eventRef),tx.get(eventRef.collection('budgetLines')),tx.get(importRef)]);
 if(!event.exists||event.data().budgetSourceSha256!==source.originalSourceSha256)throw Error('Expected source budget is missing.');
 if(['archived','completed','cancelled'].includes(event.data().status))throw Error('The event is closed to budget additions.');
 if(record.exists){if(record.data().sourceSha256!==sha)throw Error('Import identity already belongs to another snapshot.');return {alreadyApplied:true,added:0};}
 const seen=new Set(existing.docs.map(d=>identity(d.data())));
 const additions=source.rows.filter(r=>!seen.has(identity(r)));
 // Any matching row was created elsewhere. Never overwrite or reinterpret its payments/approval.
 if(additions.length!==source.rows.length)throw Error('A source addition already exists outside this import. Review instead of duplicating it.');
 const before=existing.docs.filter(d=>d.data().status!=='void').reduce((a,d)=>({planned:a.planned+Number(d.data().plannedMinor||0),paid:a.paid+Number(d.data().actualPaidMinor||0)}),{planned:0,paid:0});
 const result={alreadyApplied:false,added:additions.length,before,after:{planned:before.planned+additions.reduce((n,r)=>n+r.plannedMinor,0),paid:before.paid+additions.reduce((n,r)=>n+r.actualPaidMinor,0)},recipients:members.length};
 if(mode==='--dry-run')return result;
 for(const r of additions){
  const h=createHash('sha256').update(source.eventId+'|'+source.sourceSpreadsheetId+'|'+identity(r)).digest('hex').slice(0,32);
  const id='line-'+[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
  const {sourceRow,...fields}=r;
  tx.create(eventRef.collection('budgetLines').doc(id),{...fields,id,eventId:source.eventId,
   classification:'costed',sourceClassification:'costed',reportedEstimateMinor:r.plannedMinor,
   sourceDocument:source.sourceTitle,sourceUrl:source.sourceUrl,sourceRange:'Budget!A'+sourceRow+':S'+sourceRow,
   sourceOfFunds:r.sourceOfFunds,taskId:null,startDate:null,endDate:null,
   notes:'Added from '+source.sourceUrl+' — Budget row '+sourceRow+'. Approval and recorded paid amount copied from the owner-maintained Approved / Verified paid columns. No School finance receipt was created.',
   approvedBy:'owner-authorized-spreadsheet-import',approvedAt:now,revision:1,
   createdBy:'owner-authorized-spreadsheet-import',updatedBy:'owner-authorized-spreadsheet-import',createdAt:now,updatedAt:now});
 }
 tx.create(noticeRef,{eventId:source.eventId,type:'budget.draft.available',title:'Draft budget available',
  message:'The draft budget for '+event.data().name+' is available for review. New budget items have been added. Please review and share feedback with the event administrator.',
  recipientUids:members,readBy:[],createdAt:now,createdBy:'owner-authorized-spreadsheet-import'});
 tx.create(importRef,{...result,sourceSha256:sha,sourceUrl:source.sourceUrl,sourceRange:source.sourceRange,eventId:source.eventId,createdAt:now,pushStatus:'pending'});
 tx.create(db.collection('marathonAudit').doc(),{eventId:source.eventId,action:'budget.sheet.additions.imported',actor:'owner-authorized-spreadsheet-import',at:now,sourceSha256:sha,...result});
 // Revision makes concurrent admin edits retry instead of replacing their settings.
 tx.update(eventRef,{revision:Number(event.data().revision||0)+1,updatedAt:now,updatedBy:'owner-authorized-spreadsheet-import'});
 return result;
});
console.log(mode,JSON.stringify(outcome));
if(mode==='--dry-run')process.exit(0);
const imported=await importRef.get();
const active=await eventRef.collection('budgetLines').get();
for(const r of source.rows){const matches=active.docs.filter(d=>identity(d.data())===identity(r));if(matches.length!==1||matches[0].data().plannedMinor!==r.plannedMinor||matches[0].data().actualPaidMinor!==r.actualPaidMinor)throw Error('Imported addition verification failed.');}
console.log('VERIFIED: source additions exist exactly once; existing budget rows were not written.');
const claimed=await db.runTransaction(async tx=>{const snap=await tx.get(importRef);if(snap.data()?.pushStatus!=='pending')return false;tx.update(importRef,{pushStatus:'sending',pushStartedAt:new Date().toISOString()});return true;});
if(claimed){
 try{
  // Recheck membership immediately before selecting registered devices.
  const allowed=new Set();
  for(const uid of members){const p=(await db.collection('profiles').doc(uid).get()).data();if(p?.active===true&&p.role!=='student'&&(p.role==='super_admin'||p.marathonAccess?.active===true&&['kasaAdmin','kasaOperations','kasaEditor','kasaReviewer','kasaClient'].includes(p.marathonAccess.role)))allowed.add(uid);}
  const tokens=new Set();let last;
  for(;;){let query=db.collection('mobilePushDevices').orderBy(FieldPath.documentId()).limit(250);if(last)query=query.startAfter(last);const page=await query.get();
   for(const doc of page.docs){const d=doc.data();if(allowed.has(d.uid)&&d.marathon===true&&typeof d.token==='string'&&Date.parse(d.updatedAt||'')>=Date.now()-35*86400000)tokens.add(d.token);}
   if(page.size<250)break;last=page.docs.at(-1).id;
  }
  const list=[...tokens];let delivered=0,failed=0;
  for(let i=0;i<list.length;i+=500){const result=await getMessaging(app).sendEachForMulticast({tokens:list.slice(i,i+500),notification:{title:'Draft budget available',body:'The KASA Life Marathon draft budget is ready for review.'},data:{path:'/marathon?event='+source.eventId,workspace:'marathon'},android:{priority:'high'}});delivered+=result.successCount;failed+=result.failureCount;}
  await importRef.update({pushStatus:failed?'partial':'complete',pushCompletedAt:new Date().toISOString(),devices:list.length,delivered,failed});
  console.log('NOTIFICATIONS',JSON.stringify({inAppRecipients:imported.data().recipients,registeredDevices:list.length,delivered,failed}));
 }catch(error){await importRef.update({pushStatus:'failed',pushErrorCode:String(error.code||'delivery-failed')});throw Error('Budget and in-app notices saved; push delivery failed. Review the import record before retrying.');}
}else console.log('Notification push already attempted; not sending duplicates.');
