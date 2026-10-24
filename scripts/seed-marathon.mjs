import {readFileSync} from 'node:fs';
import {initializeApp,cert,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import firestorePackage from '@google-cloud/firestore';
import {previewChecklistImport,applyChecklistImport} from '../src/lib/marathon-seed-import.ts';
import {groupMarathonCategories,isMarathonCategorySection} from '../src/lib/marathon-categories.ts';

const options=new Map(process.argv.slice(2).map(arg=>{const at=arg.indexOf('=');return at<0?[arg,true]:[arg.slice(0,at),arg.slice(at+1)];}));
const dryRun=options.has('--dry-run'),apply=options.has('--apply');
const expectedProject=options.get('--expected-project');
const expectedVersion=options.get('--source-version');
const expectedPlan=options.get('--plan-hash');
if(dryRun===apply||typeof expectedProject!=='string'||typeof expectedVersion!=='string'||(apply&&(typeof expectedPlan!=='string'||!/^[0-9a-f]{64}$/.test(expectedPlan)))){
 console.error('Use --dry-run or --apply with --expected-project=ID and --source-version=VERSION. Apply also requires the reviewed --plan-hash=HASH.');process.exit(1);
}
const seed=JSON.parse(readFileSync(new URL('../src/data/marathon-seed.json',import.meta.url),'utf8'));
const legacy=JSON.parse(readFileSync(new URL('../src/data/marathon-seed-2026-10-23.json',import.meta.url),'utf8'));
if(seed.version!==expectedVersion){console.error('The requested source version does not match the bundled checklist.');process.exit(1);}
if(seed.items.some(task=>!isMarathonCategorySection(task.section))){console.error('Every source action must have a checklist category.');process.exit(1);}
const projectId=process.env.FIREBASE_PROJECT_ID?.trim();
const clientEmail=process.env.FIREBASE_CLIENT_EMAIL?.trim();
const privateKey=process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/^"|"$/g,'').replace(/\\n/g,'\n');
if(projectId!==expectedProject||process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()!==expectedProject||!clientEmail||!privateKey||process.env.FIRESTORE_EMULATOR_HOST){
 console.error('The configured school Firebase project and credentials must match the explicitly selected live target.');process.exit(1);
}
const actor='service:'+clientEmail;
const {v1}=firestorePackage;
let app,db,admin;
let stage='database-metadata';
try{
 admin=new v1.FirestoreAdminClient({projectId,credentials:{client_email:clientEmail,private_key:privateKey},fallback:true});
 const name=`projects/${projectId}/databases/(default)`;
 await admin.getDatabase({name},{timeout:30000});
 // Read raw metadata as well: the existing SDK's protobuf predates the edition field.
 const authClient=await admin.auth.getClient();
 const {data:database}=await authClient.request({url:'https://firestore.googleapis.com/v1/'+name,timeout:30000});
 const edition=database.databaseEdition??'STANDARD';
 console.log('MARATHON_DATABASE '+JSON.stringify({projectId,name:database.name,edition,type:database.type}));
 if(edition!=='STANDARD'||database.type!=='FIRESTORE_NATIVE')throw Error('The database does not match the existing Standard Native Firestore application.');
 app=initializeApp({credential:cert({projectId,clientEmail,privateKey})});db=getFirestore(app);
 stage=dryRun?'preview':'apply';
 const result=dryRun?await previewChecklistImport(db,seed,legacy,actor):await applyChecklistImport(db,seed,legacy,actor,expectedPlan);
 console.log('MARATHON_IMPORT_RESULT '+JSON.stringify({mode:stage,...result}));
 if(apply||result.alreadyImported){
  stage='verification';
  const [tasks,meta]=await Promise.all([db.collection('marathonTasks').get(),db.collection('marathonMeta').doc('source').get()]);
  const current=tasks.docs.filter(d=>d.data().sourceChecklist==='kasa-life-marathon-2027'&&d.data().sourceVersion===seed.version);
  if(meta.data()?.version!==seed.version||current.length!==seed.items.length)throw Error('Verification failed');
  const active=tasks.docs.map(d=>({...d.data(),id:d.id})).filter(t=>!t.archived);
  const uncategorized=active.filter(t=>!isMarathonCategorySection(t.section));
  const categories=groupMarathonCategories(active,true).map(g=>({id:g.category.id,label:g.category.label,tasks:g.tasks.length,completed:g.completed}));
  console.log('MARATHON_IMPORT_VERIFIED '+JSON.stringify({mode:apply?'apply':'read-only',version:seed.version,currentSourceTasks:current.length,activeTasks:active.length,sourceReportedDone:current.filter(d=>d.data().sourceRemarks?.toLowerCase()==='done').length,sourceCompletedWithoutInventedDate:current.filter(d=>d.data().status==='done'&&!d.data().completedAt).length,categories,uncategorizedActiveTasks:uncategorized.length,recoveryVersion:seed.version}));
  if(uncategorized.length)throw Error('Active actions need a category.');
 }
}catch(error){console.error('MARATHON_IMPORT_FAILED '+JSON.stringify({stage,code:error.code??error.status??null,type:error.name}));process.exitCode=1;}
finally{if(db)await db.terminate();if(app)await deleteApp(app);if(admin)await admin.close();}
