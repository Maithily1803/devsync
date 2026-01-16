// Run this ONCE to clean up stuck commits
// Create file: scripts/cleanup-commits.ts

import { db } from "@/server/db";

async function cleanupStuckCommits() {
  console.log("🧹 Starting commit cleanup...");

  // Find all commits stuck in "Generating" state
  const stuckCommits = await db.commit.findMany({
    where: {
      OR: [
        { summary: "Generating summary..." },
        { summary: { contains: "Generating" } },
        { summary: { contains: "Pending" } },
        { summary: { contains: "pending" } },
      ],
    },
  });

  console.log(`Found ${stuckCommits.length} stuck commits`);

  for (const commit of stuckCommits) {
    const retryCount = commit.retryCount || 0;

    if (retryCount >= 3) {
      // Mark as permanently failed
      await db.commit.update({
        where: { id: commit.id },
        data: {
          summary: "Summary generation failed (max retries)",
          retryCount: 3,
        },
      });
      console.log(`❌ Marked ${commit.commitHash.slice(0, 7)} as failed`);
    } else {
      // Reset to retry
      await db.commit.update({
        where: { id: commit.id },
        data: {
          summary: "Retry pending (attempt 1/3)",
          retryCount: 0,
        },
      });
      console.log(`🔄 Reset ${commit.commitHash.slice(0, 7)} for retry`);
    }
  }

  console.log("✅ Cleanup complete!");
}

// Run it
cleanupStuckCommits()
  .then(() => {
    console.log("Done");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  });