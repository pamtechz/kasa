import {db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {operator, newId, sameOrigin, safeText} from '@/lib/security';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await operator(req, ['super_admin', 'admin', 'agent']);
    const body = await req.json();

    const amount = Number(body.amount) || 0;
    const paymentMethod = ['mtn', 'airtel', 'zamtel', 'bank'].includes(body.paymentMethod) ? body.paymentMethod : 'mtn';
    const accountNumber = safeText(body.accountNumber, 50);
    const accountName = safeText(body.accountName, 100);

    if (amount <= 0) throw new HttpError(400, 'Enter a valid payout amount.');
    if (!accountNumber) throw new HttpError(400, 'Account or Mobile Money number is required.');
    if (!accountName) throw new HttpError(400, 'Account name is required.');

    const id = newId();
    const now = new Date().toISOString();
    const payoutData = {
      id,
      agentUid: user.uid,
      agentName: user.displayName || user.email,
      agentEmail: user.email,
      agentCode: user.agentCode || 'KASA-AGT',
      district: user.district || 'District Hub',
      amount,
      paymentMethod,
      accountNumber,
      accountName,
      status: 'pending',
      requestedAt: now,
      updatedAt: now
    };

    await db.collection('payoutRequests').doc(id).set(payoutData);

    // Notify Admins
    const noticeId = newId();
    await db.collection('notificationOutbox').doc(noticeId).set({
      title: `New Mobile Money Payout Request (ZMW ${amount.toFixed(2)})`,
      message: `Agent ${user.displayName || user.email} (${user.district}) requested ZMW ${amount.toFixed(2)} via ${paymentMethod.toUpperCase()} (${accountNumber} - ${accountName}).`,
      reference: user.agentCode || 'PAYOUT',
      recipient: 'admin',
      priority: 'urgent',
      event: 'payout_requested',
      read: false,
      readBy: [],
      createdAt: now,
      updatedAt: now,
      createdBy: user.displayName || user.email,
      createdUid: user.uid
    });

    return json({
      ok: true,
      payoutId: id,
      message: `Payout request of ZMW ${amount.toFixed(2)} submitted successfully. KASA Finance will process your payment shortly.`
    }, 201);
  } catch (e) {
    return fail(e);
  }
}

export async function GET(req: Request) {
  try {
    const user = await operator(req, ['super_admin', 'admin', 'reviewer', 'agent']);
    let snap;
    if (user.role === 'agent') {
      snap = await db.collection('payoutRequests').where('agentUid', '==', user.uid).limit(100).get();
    } else {
      snap = await db.collection('payoutRequests').limit(200).get();
    }

    const payouts = snap.docs.map(d => ({id: d.id, ...d.data()}));
    return json({payouts});
  } catch (e) {
    return fail(e);
  }
}
