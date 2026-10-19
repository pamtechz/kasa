import type {ApplicantRecord} from '@/lib/types';

export const submissionsCache = new Map<string, {items: ApplicantRecord[]; timestamp: number}>();
export const SUBMISSIONS_CACHE_TTL = 15_000;

export function invalidateSubmissionsCache() {
  submissionsCache.clear();
}
