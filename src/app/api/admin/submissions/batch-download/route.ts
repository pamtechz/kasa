import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {fail,HttpError} from '@/lib/errors';
import {requirePermission,operator,sameOrigin} from '@/lib/security';

export const runtime='nodejs';

function csvEscape(text: unknown): string {
  if (text === null || text === undefined) return '""';
  // Neutralize formulas (including leading whitespace and spreadsheet
  // controls) before fields are opened in Excel or other CSV applications.
  const plain = String(text).replace(/[\u0000-\u001f\u007f]/g, ' ');
  const protectedValue = /^\s*[=+\-@]/.test(plain) ? "'" + plain : plain;
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    await requirePermission(req,'applications.read');
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : [];

    let snapshot;
    if (ids.length > 0) {
      const docs = await Promise.all(ids.map(id => db.collection('submissions').doc(id).get()));
      const validDocs = docs.filter(d => d.exists);
      validDocs.sort((a, b) => String(b.data()?.submittedAt || '').localeCompare(String(a.data()?.submittedAt || '')));
      snapshot = { docs: validDocs };
    } else {
      snapshot = await db.collection('submissions').orderBy('submittedAt', 'desc').limit(500).get();
    }

    const headers = [
      'Reference',
      'Form Title',
      'Status',
      'Funding Method',
      'Applicant Email',
      'Applicant Name',
      'Phone Number',
      'District',
      'Agent ID',
      'Submitted At'
    ];

    const rows = snapshot.docs.map(doc => {
      const x = doc.data() || {};
      const answers = x.answers || {};
      const emailField = x.formSnapshot?.sections?.flatMap((s: any) => s.fields).find((f: any) => f.type === 'email');
      const email = emailField ? String(answers[emailField.id] || '').trim() : String(answers.email || '');
      const nameField = x.formSnapshot?.sections?.flatMap((s: any) => s.fields).find((f: any) => /name/i.test(f.label) || /name/i.test(f.id));
      const name = nameField ? String(answers[nameField.id] || '').trim() : String(answers.fullNames || answers['full-name'] || '');
      const phone = String(answers.phone || answers.mobileNumber || '');
      const district = String(answers.district || answers.ward || '');

      return [
        csvEscape(x.reference),
        csvEscape(x.formTitle),
        csvEscape(x.status),
        csvEscape(x.fundingMethod || 'self_funded'),
        csvEscape(email),
        csvEscape(name),
        csvEscape(phone),
        csvEscape(district),
        csvEscape(x.agentId || 'Direct'),
        csvEscape(x.submittedAt)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const filename = ids.length > 0
      ? `KASA-Selected-Applications-${new Date().toISOString().slice(0, 10)}.csv`
      : `KASA-All-Applications-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return fail(e);
  }
}
