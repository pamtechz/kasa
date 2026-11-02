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
      eligibleForBonus: false,
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
    const requestedMonth=url.searchParams.get('month')||'';
    const monthKey=/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)?requestedMonth:new Date().toISOString().slice(0,7);

    // Fetch all profiles for agents
    const profilesSnap = await db.collection('profiles').where('role', '==', 'agent').get();
    const agents = profilesSnap.docs.map(d => ({uid: d.id, ...d.data()}));

    // Fetch all student submissions
    const submissions:Array<Record<string,unknown>>=[];
    let cursor:FirebaseFirestore.QueryDocumentSnapshot|undefined;
    let partial=false;
    for(let page=0;page<40;page++){
      let q=db.collection('submissions').where('formKind','==','student').orderBy('__name__').limit(250);
      if(cursor)q=q.startAfter(cursor);
      const snap=await q.get();
      submissions.push(...snap.docs.map(d=>({id:d.id,...d.data()})));
      if(snap.size<250)break;
      cursor=snap.docs[snap.docs.length-1];
      if(page===39)partial=true;
    }

    // Group submissions by agentId or agentCode
    const agentStats: Record<string, {
      uid: string;
      displayName: string;
      district: string;
      totalReferrals: number;
      confirmedEnrollments: number;
      lifetimeConfirmedEnrollments:number;
      monthlyEarned: number;
    }> = {};

    for (const a of agents) {
      agentStats[a.uid] = {
        uid: a.uid,
        displayName: (a as any).displayName || (a as any).email,
        district: (a as any).district || 'District Hub',
        totalReferrals: 0,
        confirmedEnrollments: 0,
        lifetimeConfirmedEnrollments:0,
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
          agentStats[agentUid].lifetimeConfirmedEnrollments += 1;
          // The selected month drives both the tier and the monthly earnings.
          if(String(x.commission?.approvedAt||'').startsWith(monthKey)){
            agentStats[agentUid].confirmedEnrollments += 1;
            agentStats[agentUid].monthlyEarned += eligibility.amount;
          }
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
      partial,
      topDistrict: leaderboard[0]?.district || 'Lusaka',
      leaderboard
    });
  } catch (e) {
    return fail(e);
  }
}
