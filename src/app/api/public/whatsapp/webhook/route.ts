import {NextRequest, NextResponse} from 'next/server';
import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import {db} from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_WEBHOOK_BYTES = 100_000;
const MAX_LOOKUPS_PER_DAY = 3;

function configuredSecret(): string | null {
  const secret = process.env.WHATSAPP_APP_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

function verifyMetaSignature(bytes: Buffer, provided: string | null, secret: string): boolean {
  if (!provided || !/^sha256=[a-f0-9]{64}$/i.test(provided)) return false;
  const expected = createHmac('sha256', secret).update(bytes).digest();
  const received = Buffer.from(provided.slice(7), 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function canonicalZambianPhone(value: unknown): string | null {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^260[0-9]{9}$/.test(digits)) return digits;
  if (/^0[0-9]{9}$/.test(digits)) return '26' + digits;
  if (/^[0-9]{9}$/.test(digits)) return '260' + digits;
  return null;
}

async function sendWhatsAppMessage(toPhone: string, message: string): Promise<void> {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.error('WhatsApp dispatch is not configured.');
    return;
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
      method: 'POST',
      headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({messaging_product:'whatsapp',to:toPhone,type:'text',text:{body:message}}),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) console.error('WhatsApp dispatch failed with HTTP', res.status);
  } catch {
    console.error('WhatsApp dispatch failed.');
  }
}

export async function GET(req: NextRequest) {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected) return NextResponse.json({error:'WhatsApp webhook is not configured.'},{status:503});

  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const a = Buffer.from(expected);
  const b = Buffer.from(token || '');
  const verified = a.length === b.length && timingSafeEqual(a,b);
  if (mode === 'subscribe' && verified && challenge !== null) {
    return new NextResponse(challenge, {status:200});
  }
  return NextResponse.json({error:'Invalid verify token.'},{status:403});
}

export async function POST(req: NextRequest) {
  const secret = configuredSecret();
  if (!secret) return NextResponse.json({error:'WhatsApp webhook is not configured.'},{status:503});

  let raw: Buffer;
  try {
    raw = Buffer.from(await req.arrayBuffer());
  } catch {
    return NextResponse.json({error:'Invalid request body.'},{status:400});
  }
  if (raw.length > MAX_WEBHOOK_BYTES) return NextResponse.json({error:'Payload too large.'},{status:413});
  if (!verifyMetaSignature(raw,req.headers.get('x-hub-signature-256'),secret)) {
    return NextResponse.json({error:'Invalid webhook signature.'},{status:403});
  }

  try {
    const body = JSON.parse(raw.toString('utf8'));
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message || message.type !== 'text') return NextResponse.json({status:'ignored_non_text'});

    const configuredPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (configuredPhoneId && String(value?.metadata?.phone_number_id || '') !== configuredPhoneId) {
      return NextResponse.json({status:'ignored_other_business_number'});
    }

    const phone = canonicalZambianPhone(message.from);
    const eventId = typeof message.id === 'string' ? message.id : '';
    if (!phone || !/^wamid[.\w-]{4,240}$/.test(eventId)) {
      return NextResponse.json({status:'ignored_invalid_message'});
    }
    const match = String(message.text?.body || '').trim().match(/^status\s+([a-z0-9-]{10,30})$/i);
    if (!match) return NextResponse.json({status:'ignored_non_status'});

    const reference = match[1].toUpperCase();
    const day = new Date().toISOString().slice(0,10);
    const limitRef = db.collection('whatsappRateLimits').doc(`${phone}:${day}`);
    const deliveryId = createHash('sha256').update(eventId).digest('hex');
    const deliveryRef = db.collection('whatsappWebhookDeliveries').doc(deliveryId);
    const decision = await db.runTransaction(async tx => {
      const [delivery, limit] = await Promise.all([tx.get(deliveryRef),tx.get(limitRef)]);
      if (delivery.exists) return 'duplicate';
      const count = Number(limit.data()?.count || 0);
      tx.create(deliveryRef,{phone,reference,createdAt:new Date().toISOString()});
      if (count >= MAX_LOOKUPS_PER_DAY) return 'rate_limited';
      tx.set(limitRef,{count:count+1,phone,date:day,updatedAt:new Date().toISOString()},{merge:true});
      return 'accepted';
    });
    if (decision === 'duplicate') return NextResponse.json({status:'duplicate_ignored'});
    if (decision === 'rate_limited') {
      await sendWhatsAppMessage(phone,'KASA: You have reached the daily status lookup limit. Please try again tomorrow.');
      return NextResponse.json({status:'rate_limited'});
    }

    const q = await db.collection('submissions').where('reference','==',reference).limit(1).get();
    const submission = q.docs[0]?.data();
    const answers = submission?.answers || {};
    const registeredPhones = [
      answers['phone'], answers['mobileNumber'], answers['phone-number'],
      answers['whatsappNumber'], answers['whatsapp-number']
    ].map(canonicalZambianPhone).filter(Boolean);
    // Knowledge of a reference is not proof of ownership. Never disclose a
    // student's identity, application status or bearer PDF URL to another phone.
    if (!submission || !registeredPhones.includes(phone)) {
      await sendWhatsAppMessage(phone,
        'KASA: We cannot verify an application for this WhatsApp number and reference. Please contact the Admissions Office.');
      return NextResponse.json({status:'unverified_reference'});
    }

    const status = String(submission.status || 'submitted').replace(/_/g,' ').toUpperCase();
    await sendWhatsAppMessage(phone,
      `KASA ADMISSIONS\nReference: ${reference}\nApplication status: ${status}\nFor official documents, sign in to your KASA portal.\nDo not share your private document links.`);
    return NextResponse.json({status:'processed'});
  } catch {
    console.error('WhatsApp webhook processing error.');
    return NextResponse.json({error:'Could not process event.'},{status:500});
  }
}
