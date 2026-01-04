import { db } from "@/server/db";
import { CREDIT_COSTS, type CreditAction } from "./credit-plans";

export class InsufficientCreditsError extends Error {
  constructor(required: number, available: number) {
    super(`Insufficient credits. Required: ${required}, Available: ${available}`);
    this.name = "InsufficientCreditsError";
  }
}

export async function getUserCredits(userId: string): Promise<number> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  return user?.credits || 0;
}

export async function consumeCredits(
  userId: string,
  action: CreditAction,
  projectId?: string,
  description?: string
): Promise<{ success: boolean; remaining: number }> {
  const cost = CREDIT_COSTS[action];

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  if (!user || user.credits < cost) {
    throw new InsufficientCreditsError(cost, user?.credits || 0);
  }

  // ✅ Atomic transaction
  const [updatedUser] = await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { credits: { decrement: cost } },
    }),
    db.creditUsage.create({
      data: {
        userId,
        projectId,
        action,
        credits: cost,
        description,
      },
    }),
  ]);

  return {
    success: true,
    remaining: updatedUser.credits,
  };
}

/**
 * ✅ Recent credit activity
 * - Only last 24 hours
 * - Max 15 entries (default)
 */
export async function getCreditUsageHistory(
  userId: string,
  limit = 15
) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return db.creditUsage.findMany({
    where: {
      userId,
      createdAt: {
        gte: oneDayAgo,
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      project: {
        select: {
          name: true,
        },
      },
    },
  });
}

export async function getCreditStats(userId: string) {
  const [totalSpent, lastMonth, user] = await Promise.all([
    db.creditUsage.aggregate({
      where: { userId },
      _sum: { credits: true },
    }),
    db.creditUsage.aggregate({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      _sum: { credits: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    }),
  ]);

  return {
    current: user?.credits || 0,
    totalSpent: totalSpent._sum.credits || 0,
    lastMonthUsage: lastMonth._sum.credits || 0,
  };
}
