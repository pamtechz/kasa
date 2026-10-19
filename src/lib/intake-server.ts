import 'server-only';
import {db} from './firebase-admin';
import {normalizedIntake, type IntakePolicy} from './intake-policy';

let intakeCache: {policy: IntakePolicy; timestamp: number} | null = null;
const INTAKE_CACHE_TTL = 45_000;

export async function loadIntake(forceRefresh = false): Promise<IntakePolicy> {
 if (!forceRefresh && intakeCache && Date.now() - intakeCache.timestamp < INTAKE_CACHE_TTL) {
  return intakeCache.policy;
 }
 const doc = await db.collection('settings').doc('intake').get();
 const policy = normalizedIntake(doc.data()?.policy);
 intakeCache = {policy, timestamp: Date.now()};
 return policy;
}

export function invalidateIntakeCache() {
 intakeCache = null;
}
