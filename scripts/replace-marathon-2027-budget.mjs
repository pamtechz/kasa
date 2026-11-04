#!/usr/bin/env node
/**
 * One-time atomic replacement of ONLY the March 2027 KASA Life Marathon event
 * budget, from the user's documented working draft. The previous version and
 * every old line (including any approved/paid values) are preserved in an
 * immutable dated archive. No money is transferred or marked paid.
 *
 * Usage:
 *    node scripts/replace-marathon-2027-budget.mjs --dry-run
 *    node scripts/replace-marathon-2027-budget.mjs --apply
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {initializeApp,cert,getApps} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
const PROJECT='kasa-recruite',EVENT_ID='kasa-life-2027-march';
const SOURCE='src/data/marathon-2027-working-budget.json';
const manifest=JSON.parse(readFileSync(SOURCE,'utf8'));
const mode=process.argv[2];
if(!['--dry-run','--apply'].includes(mode))throw Error('Explicit --dry-run or --apply is required.');
if(manifest.eventId!==EVENT_ID||manifest.targetRunners!==5000||
 manifest.registrationFeeMinor!==45000||manifest.plannedCostedMinor!==151975000||
 manifest.sourceDocumentSha256!=='e176cd00bfb29c5c0bf0f48d673a51d34873984226d8f58abb45e29459fef4ce')
 throw Error('The authenticated source draft does not match the approved KASA working budget.');
const rows=manifest.rows;
if(rows.length!==89)throw Error('Working budget must contain all 89 source rows.');
const money=text=>{
 const value=String(text||'').trim();
 if(!/^(?:K)?[0-9][0-9,]*$/.test(value))return null;
 return Number(value.replace(/^K/,'').replaceAll(',',''))*100;
};
let counted=0,unallocated=0;
const now=new Date().toISOString();
const lines=rows.map((row,i)=>{
 const report=money(row.totalCostLabel);
 const quantityNumber=/^\d[\d,]*$/.test(row.quantityLabel)
  ?Number(row.quantityLabel.replaceAll(',','')):Number.parseInt(row.quantityLabel,10)||1;
 if(!Number.isSafeInteger(quantityNumber)||quantityNumber<1||quantityNumber>1000000)
  throw Error('Invalid quantity on draft row '+(i+1));
 if(!['costed','outside_consolidated','within_allocation','in_kind','tbc','free','waived'].includes(row.classification))
  throw Error('Unknown budget classification on source row '+(i+1));
 const included=row.classification==='costed';
 const plannedMinor=included?report:0;
 if(included&&(!Number.isSafeInteger(plannedMinor)||plannedMinor<=0||plannedMinor%quantityNumber!==0))
  throw Error('Invalid / unreconciled source amount on row '+(i+1));
 if(!included&&report!==null&&row.classification==='outside_consolidated')unallocated+=report;
 counted+=plannedMinor;
 const notes='Source of funds: '+row.sourceOfFunds+' | Payment due: '+row.dueDateText+
  ' | Draft quantity: '+(row.quantityLabel||'not stated')+
  ' | Draft unit cost: '+(row.unitCostLabel||'not stated')+
  ' | Draft total: '+row.totalCostLabel+
  (row.classification==='outside_consolidated'?
   ' | Priced in source document but excluded from consolidated K1,519,750; reconciliation required.':'');
 return {
  id:'working-'+String(i+1).padStart(3,'0'),eventId:EVENT_ID,
  category:row.category,description:row.description,
  quantity:included?quantityNumber:quantityNumber,
  unitCostMinor:included?plannedMinor/quantityNumber:0,months:1,
  plannedMinor,actualPaidMinor:0,status:'draft',
  taskId:null,startDate:null,endDate:null,
  notes,revision:1,createdBy:'kasa-budget-controlled-migration',
  createdAt:now,updatedBy:'kasa-budget-controlled-migration',updatedAt:now,
  sourceSection:row.section,sourceOfFunds:row.sourceOfFunds,
  dueDateText:row.dueDateText,sourceQuantityLabel:row.quantityLabel,
  sourceUnitCostLabel:row.unitCostLabel,sourceTotalCostLabel:row.totalCostLabel,
  sourceClassification:row.classification,
  reportedEstimateMinor:report||0,
  reportedPaidClaimMinor:row.description.startsWith('Route Measurement,')?1230000:0,
  sourceDocument:manifest.sourceDocument,
  sourceDocumentSha256:manifest.sourceDocumentSha256
 };
});
if(counted!==manifest.plannedCostedMinor||unallocated!==1700000)
 throw Error('Source draft reconciliation failed: '+counted+' / '+unallocated);
const raw=process.env.KASA_FIREBASE_SERVICE_ACCOUNT_JSON;
if(!raw)throw Error('Production Firebase credentials are missing. No changes have been made.');
const credential=JSON.parse(raw);
if(credential.project_id!==PROJECT||credential.type!=='service_account'||!credential.private_key)
 throw Error('Service account is not authorised for the required KASA project.');
if(!getApps().length)initializeApp({credential:cert(credential),projectId:PROJECT});
const db=getFirestore();
const eventRef=db.collection('marathonEvents').doc(EVENT_ID);
const oldSnap=await eventRef.collection('budgetLines').limit(501).get();
if(oldSnap.size>500)throw Error('More than 500 existing budget rows; manual migration required to avoid partial archiving.');
const eventSnap=await eventRef.get();
const archiveId='working-draft-20261104-'+manifest.sourceDocumentSha256.slice(0,16);
const archiveRef=db.collection('marathonBudgetArchives').doc(EVENT_ID+'--'+archiveId);
const archiveSnap=await archiveRef.get();
const sourceHash=createHash('sha256').update(readFileSync(SOURCE)).digest('hex');
const existingImport=eventSnap.data()?.budgetSourceSha256;
console.log('Project:',PROJECT,'Event:',EVENT_ID,'Operation:',mode);
console.log('Current event rows:',oldSnap.size,'New draft rows:',lines.length);
console.log('Costed budget (K):',counted/100,'Uncounted priced items (K):',unallocated/100);
console.log('Archive ID:',archiveRef.id,'Source JSON SHA256:',sourceHash);
if(existingImport===manifest.sourceDocumentSha256){
 if(oldSnap.size===lines.length&&oldSnap.docs.every(d=>/^working-\d{3}$/.test(d.id))){
  console.log('Already imported this exact working draft. No changes.');
  process.exit(0);
 }
 throw Error('Event records an imported source but lines are incomplete; aborting rather than overwriting.');
}
if(archiveSnap.exists)throw Error('Migration archive ID already exists but active budget is different. Manual reconciliation required.');
const MAX_OPS=500,expectedOps=oldSnap.size*2+lines.length+3;
if(expectedOps>MAX_OPS)throw Error('Atomic write would exceed Firestore 500-write limit. Nothing changed.');
const oldActualPaidMinor=oldSnap.docs.reduce((v,d)=>v+Number(d.data().actualPaidMinor||0),0);
console.log('Previous budget payments preserved in archive (K):',oldActualPaidMinor/100);
if(mode==='--dry-run'){
 console.log('DRY RUN VALIDATED — NO WRITES. Next: --apply with same source.');
 process.exit(0);
}
const batch=db.batch();
batch.create(archiveRef,{
 eventId:EVENT_ID,sourceVersion:manifest.sourceVersion,replacementSourceSha256:manifest.sourceDocumentSha256,
 sourceJsonSha256:sourceHash,archivedAt:now,archivedBy:'production-admin-budget-workflow',
 previousEvent:eventSnap.exists?eventSnap.data():null,previousLineCount:oldSnap.size,
 previousPlannedMinor:oldSnap.docs.reduce((v,d)=>v+Number(d.data().plannedMinor||0),0),
 previousActualPaidMinor:oldActualPaidMinor,archivedLineIds:oldSnap.docs.map(d=>d.id),
 replacementLineCount:lines.length,replacementPlannedMinor:counted,
 reason:'Explicit replacement request for new comprehensive working budget, 4 Nov 2026'
});
for(const doc of oldSnap.docs){
 batch.create(archiveRef.collection('budgetLines').doc(doc.id),{
  ...doc.data(),originalId:doc.id,originalUpdateTime:doc.updateTime.toDate().toISOString()
 });
 batch.delete(doc.ref,{lastUpdateTime:doc.updateTime});
}
for(const line of lines)batch.create(eventRef.collection('budgetLines').doc(line.id),line);
const eventChanges={
 targetRunners:manifest.targetRunners,registrationFeeMinor:manifest.registrationFeeMinor,
 budgetSourceDocument:manifest.sourceDocument,
 budgetSourceSha256:manifest.sourceDocumentSha256,
 budgetSourceVersion:manifest.sourceVersion,
 budgetCostedTotalMinor:counted,
 budgetReportedPaidMinor:manifest.reportedPaidMinor,
 budgetReportedOutstandingMinor:manifest.reportedOutstandingMinor,
 budgetUncountedPricedMinor:unallocated,
 budgetSponsorshipTargetMinor:manifest.cashSponsorshipTargetMinor,
 eventVenue:manifest.eventVenue,launchDate:manifest.launchDate,
 launchVenue:manifest.launchVenue,launchTime:manifest.launchTime,
 budgetContingencyAlreadyIncluded:true,
 budgetArchiveId:archiveRef.id,
 budgetWorkingNotes:manifest.note,
 updatedAt:now,updatedBy:'production-admin-budget-workflow'
};
if(eventSnap.exists)batch.update(eventRef,eventChanges,{lastUpdateTime:eventSnap.updateTime});
else batch.create(eventRef,{
 id:EVENT_ID,name:'KASA Life Marathon — March 2027',
 preparationStart:'2026-11-01',eventDate:'2027-03-21',closeoutDate:'2027-04-21',
 status:'planning',currency:'ZMW',revision:1,createdAt:now,createdBy:'production-admin-budget-workflow',
 adminUids:[],budgetEditorUids:[],budgetViewerUids:[],budgetApproverUids:[],
 ...eventChanges
});
batch.create(db.collection('marathonAudit').doc(),{
 eventId:EVENT_ID,action:'budget.working_draft.replaced',at:now,
 actor:'production-admin-budget-workflow',archiveId:archiveRef.id,
 before:{lineCount:oldSnap.size,actualPaidMinor:oldActualPaidMinor},
 after:{lineCount:lines.length,plannedMinor:counted,targetRunners:5000},
 sourceDocument:manifest.sourceDocument,sourceSha256:manifest.sourceDocumentSha256
});
await batch.commit();
const [verified,active,backedUp]=await Promise.all([
 eventRef.get(),eventRef.collection('budgetLines').get(),archiveRef.collection('budgetLines').get()]);
const total=active.docs.reduce((v,d)=>v+Number(d.data().plannedMinor||0),0);
if(verified.data()?.budgetSourceSha256!==manifest.sourceDocumentSha256||
 verified.data()?.targetRunners!==5000||active.size!==89||
 backedUp.size!==oldSnap.size||total!==counted)
 throw Error('POST-REPLACEMENT VERIFICATION FAILED. Review the event and archive before further changes.');
console.log('SUCCESS: old budget archived, 89 working lines activated, exact total K'+(total/100).toLocaleString('en-US'));
console.log('Existing paid and approval records remain retrievable from '+archiveRef.path);
