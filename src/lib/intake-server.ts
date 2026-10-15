import 'server-only';
import {db} from './firebase-admin';
import {normalizedIntake} from './intake-policy';
export async function loadIntake(){
 const doc=await db.collection('settings').doc('intake').get();
 return normalizedIntake(doc.data()?.policy);
}
