import {NextRequest, NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {FieldValue} from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'kasa_whatsapp_verify_token_2027';

// 1. GET: Handles Meta WhatsApp Cloud API Webhook Verification
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, {status: 200});
  }

  return NextResponse.json({error: 'Invalid verify token.'}, {status: 403});
}

// 2. POST: Handles Incoming WhatsApp Message Events & Status Checks
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Extract Meta WhatsApp message object
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== 'text') {
      return NextResponse.json({status: 'ignored_non_text'});
    }

    const senderPhone = message.from; // E.164 format e.g. 260971234567
    const messageBody = String(message.text?.body || '').trim();

    // Regex Body Trigger: /^\s*status\s+([A-Z0-9\-]{10,20})\s*$/i
    const statusRegex = /^\s*status\s+([A-Z0-9\-]{10,20})\s*$/i;
    const match = messageBody.match(statusRegex);

    if (!match) {
      return NextResponse.json({
        status: 'invalid_format_ignored',
        hint: 'Send "STATUS KASA-2027-XXXXXXXX" to check your application status.'
      });
    }

    const cleanRef = match[1].toUpperCase().trim();

    // Rate Limiting: Max 3 lookups per phone number in 24 hours
    const todaySlot = new Date().toISOString().slice(0, 10);
    const rateLimitRef = db.collection('whatsappRateLimits').doc(`${senderPhone}:${todaySlot}`);
    const rateSnap = await rateLimitRef.get();
    const currentCount = Number(rateSnap.data()?.count || 0);

    if (currentCount >= 3) {
      return NextResponse.json({
        status: 'rate_limited',
        message: 'Daily status check limit reached (3 lookups per 24 hours). Try again tomorrow.'
      });
    }

    // Increment rate limit counter
    await rateLimitRef.set({
      count: FieldValue.increment(1),
      phone: senderPhone,
      date: todaySlot,
      updatedAt: new Date().toISOString()
    }, {merge: true});

    const newCount = currentCount + 1;

    // Lookup Submission in Firestore
    const subSnap = await db.collection('submissions').where('reference', '==', cleanRef).limit(1).get();

    if (subSnap.empty) {
      const responseText = `KASA ADMISSIONS VERIFICATION\n----------------------------\nReference: ${cleanRef}\nStatus: NOT FOUND\n\nNo official application found matching reference "${cleanRef}". Please verify the reference number and try again.\n\n${newCount === 2 ? 'Notice: You have 1 remaining status lookup today.' : ''}`;

      return NextResponse.json({
        status: 'not_found',
        phone: senderPhone,
        reference: cleanRef,
        message: responseText,
        remainingLookups: 3 - newCount
      });
    }

    const app = subSnap.docs[0].data();
    const id = subSnap.docs[0].id;
    const answers = app.answers || {};

    const studentName = String(answers['full-name'] || answers['fullNames'] || 'Applicant');
    const programmeTitle = String(answers['programme-pathway'] || app.formTitle || 'General Agriculture');
    const isAccepted = ['accepted', 'letter_issued', 'cdf_submitted', 'cdf_approved', 'payment_verified'].includes(app.status);

    const tokenQuery = app.downloadToken ? `?token=${encodeURIComponent(app.downloadToken)}` : '';
    const letterUrl = `https://kasaschool.vercel.app/api/public/submissions/${id}/letter${tokenQuery}`;

    let replyMessage = `KASA OFFICIAL ADMISSIONS\n----------------------------\nRef: ${app.reference}\nStudent: ${studentName}\nCourse: ${programmeTitle}\nStatus: ${app.status.toUpperCase().replaceAll('_', ' ')}\nFunding: ${app.fundingMethod === 'cdf' ? 'CDF Sponsorship' : 'Self-Funded'}\n`;

    if (isAccepted) {
      replyMessage += `\nYour Admission Offer Pack is ready!\nDownload PDF: ${letterUrl}\n`;
    } else {
      replyMessage += `\nYour application is under review by the KASA Admissions Directorate.\n`;
    }

    if (newCount === 2) {
      replyMessage += `\nNotice: You have 1 remaining status lookup today.`;
    }

    return NextResponse.json({
      status: 'success',
      phone: senderPhone,
      reference: app.reference,
      replyMessage,
      remainingLookups: 3 - newCount
    });
  } catch (e) {
    return NextResponse.json({error: e instanceof Error ? e.message : 'Webhook error.'}, {status: 500});
  }
}
