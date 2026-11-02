import {NextRequest} from 'next/server';
import {json} from '@/lib/errors';
import {oauthReadiness} from '@/lib/r2-oauth';
export const runtime='nodejs';
// Non-sensitive configuration status, available before guest authentication.
export async function GET(req:NextRequest){return json(oauthReadiness(req.url));}
