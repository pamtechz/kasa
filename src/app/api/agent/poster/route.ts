import {db} from '@/lib/firebase-admin';
import {fail, HttpError} from '@/lib/errors';
import {requirePermission} from '@/lib/security';
import {generateAgentPosterPdf, type AgentPosterData} from '@/lib/pdf-agent-poster';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const user = await requirePermission(req,'agent.analytics');
    const agentCode = user.agentCode || `KASA-AGT-${user.uid.slice(0, 6).toUpperCase()}`;
    const referralLink = `https://kasaschool.vercel.app/apply/student-enrollment?ref=${agentCode}`;

    const posterData: AgentPosterData = {
      agentName: user.displayName || user.email,
      agentCode,
      district: user.district || 'District Hub',
      phone: user.phone || '+260 574 203 660',
      referralLink
    };

    const pdfBytes = await generateAgentPosterPdf(posterData);
    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="KASA-Agent-Flyer-${agentCode}.pdf"`,
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (e) {
    return fail(e);
  }
}
