// src/app/api/credits/stats/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCreditStats, getCreditUsageHistory } from "@/lib/credit-service";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [stats, history] = await Promise.all([
      getCreditStats(userId),
      getCreditUsageHistory(userId, 10),
    ]);

    return NextResponse.json({ stats, history });
  } catch (error) {
    console.error("❌ Credit stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}