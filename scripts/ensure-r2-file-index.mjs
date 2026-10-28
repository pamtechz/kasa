// Run with the deployment's existing Firebase Admin credentials before rolling
// out the ordered R2 listing. This only creates the declared additive index.
import {readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import firestore from '@google-cloud/firestore';
const {v1}=firestore;

const projectId=process.env.FIREBASE_PROJECT_ID?.trim();
const clientEmail=process.env.FIREBASE_CLIENT_EMAIL?.trim();
const privateKey=process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/^"|"$/g,'').replace(/\\n/g,'\n');
if(!projectId||!clientEmail||!privateKey)throw Error('Firebase Admin deployment credentials are required to provision the R2 index.');
const definition=JSON.parse(readFileSync(new URL('../firestore.indexes.json',import.meta.url),'utf8'))
 .indexes.find(index=>index.collectionGroup==='r2Files');
if(!definition)throw Error('The R2 file index definition is missing.');
const parent=`projects/${projectId}/databases/(default)/collectionGroups/r2Files`;
const admin=new v1.FirestoreAdminClient({projectId,credentials:{client_email:clientEmail,private_key:privateKey},fallback:true});
function matchesDefinition(index){
 const fields=(index.fields||[]).filter(field=>field.fieldPath!=='__name__');
 return (index.queryScope==='COLLECTION'||index.queryScope===1)&&fields.length===definition.fields.length&&
  fields.every((field,i)=>field.fieldPath===definition.fields[i].fieldPath&&
   (field.order===definition.fields[i].order||field.order===(definition.fields[i].order==='ASCENDING'?1:2)));
}
try{
 const [indexes]=await admin.listIndexes({parent},{timeout:30000});
 let index=indexes.find(matchesDefinition);
 if(!index){
  console.log('Creating the declared R2 file listing index.');
  try{
   const [operation]=await admin.createIndex({parent,index:{queryScope:definition.queryScope,fields:definition.fields}},{timeout:30000});
   [index]=await operation.promise();
  }catch(error){
   // Another deployment may have created the same index while this build ran.
   if(error.code!==6)throw error;
  }
 }
 for(let attempt=0;attempt<120;attempt++){
  if(index?.name)[index]=await admin.getIndex({name:index.name},{timeout:30000});
  else{
   const [current]=await admin.listIndexes({parent},{timeout:30000});
   index=current.find(matchesDefinition);
  }
  if(index?.state==='READY'||index?.state===2){console.log('R2 file listing index: READY.');break;}
  if(index?.state==='NEEDS_REPAIR'||index?.state===3)throw Error('R2 file listing index needs repair.');
  if(attempt===119)throw Error('R2 file listing index is not ready; keep the previous release active.');
  await delay(5000);
 }
}catch(error){
 console.error('R2 index provisioning failed.',{code:error.code||null,type:error.name});
 process.exitCode=1;
}finally{await admin.close();}
