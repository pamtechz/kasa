import {db} from '@/lib/firebase-admin';
import {fail, json} from '@/lib/errors';
import {operator} from '@/lib/security';
import {commissionDecision} from '@/lib/commission-eligibility';

export const runtime = 'nodejs';

type AgentTier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond';

function calculateAgentTier(enrollmentsCount: number): {
  tier: AgentTier;
  eligibleForBonus: boolean;
  bonusAmount: number;
} {
  if (enrollmentsCount >= 20) {
    return {
      tier: 'Diamond',
      eligibleForBonus: true,
      bonusAmount: 0 // No bonus may be invented from enrollment counts
    };
  }
  if (enrollmentsCount >= 13) {
    return {
      tier: 'Gold',
      eligibleForBonus: false,
      bonusAmount: 0
    };
  }
  if (enrollmentsCount >= 6) {
    return {
      tier: 'Silver',
      eligibleForBonus: false,
      bonusAmount: 0
    };
  }
  return {
    tier: 'Bronze',
    eligibleForBonus: false,
    bonusAmount: 0
  };
}

export async function GET(req: Request) {
  try {
    await operator(req, ['super_admin', 'admin', 'reviewer', 'agent']);

    const url = new URL(req.url);
    const monthKey = url.searchParams.get('month') || new Date().toISOString().slice(0, 7); // e.g. 2026-10

    // Fetch all profiles for agents
    const profilesSnap = await db.collection('profiles').where('role', '==', 'agent').get();
    const agents = profilesSnap.docs.map(d => ({uid: d.id, ...d.data()}));

    // Fetch all student submissions
    const subSnap = await db.collection('submissions').where('formKind', '==', 'student').limit(500).get();
    const submissions = subSnap.docs.map(d => ({id: d.id, ...d.data()}));

    // Group submissions by agentId or agentCode
    const agentStats: Record<string, {
      uid: string;
      displayName: string;
      email: string;
      agentCode: string;
      district: string;
      totalReferrals: number;
      confirmedEnrollments: number;
      monthlyEarned: number;
    }> = {};

    for (const a of agents) {
      const code = (a as any).agentCode || `KASA-AGT-${a.uid.slice(0, 6).toUpperCase()}`;
      agentStats[a.uid] = {
        uid: a.uid,
        displayName: (a as any).displayName || (a as any).email,
        email: (a as any).email,
        agentCode: code,
        district: (a as any).district || 'District Hub',
        totalReferrals: 0,
        confirmedEnrollments: 0,
        monthlyEarned: 0
      };
    }

    for (const sub of submissions) {
      const x = sub as any;
      const agentUid = x.agentId || x.assignedAgentUid;
      if (agentUid && agentStats[agentUid]) {
        agentStats[agentUid].totalReferrals += 1;

        const eligibility=commissionDecision(x);
        const isConfirmed=eligibility.eligible;
        if (isConfirmed) {
          agentStats[agentUid].confirmedEnrollments += 1;
          agentStats[agentUid].monthlyEarned += eligibility.amount;
        }
      }
    }

    // Build Leaderboard Array with Dynamic Tiers and Bonus Computations
    const leaderboard = Object.values(agentStats)
      .map(stat => {
        const tierInfo = calculateAgentTier(stat.confirmedEnrollments);
        return {
          ...stat,
          ...tierInfo,
          totalPayoutWithBonus: stat.monthlyEarned + tierInfo.bonusAmount
        };
      })
      .sort((a, b) => b.confirmedEnrollments - a.confirmedEnrollments);

    return json({
      monthKey,
      totalAgents: leaderboard.length,
      topDistrict: leaderboard[0]?.district || 'Lusaka',
      leaderboard
    });
  } catch (e) {
    return fail(e);
  }
}
