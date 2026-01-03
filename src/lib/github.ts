// src/lib/github.ts
import axios from "axios";
import { Octokit } from "@octokit/rest";
import { db } from "@/server/db";
import { aiSummariseCommit } from "./ai-service";

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

type CommitResponse = {
  commitHash: string;
  commitMessage: string;
  commitAuthorName: string;
  commitAuthorAvatar: string;
  commitDate: string;
};

/* ---------------- Helpers ---------------- */
function parseGitHubUrl(url: string) {
  const u = new URL(url);
  const [owner, repo] = u.pathname.replace(/^\/|\.git$/g, "").split("/");
  if (!owner || !repo) throw new Error("Invalid GitHub URL");
  return { owner, repo };
}

async function fetchDiff(githubUrl: string, hash: string) {
  try {
    const { owner, repo } = parseGitHubUrl(githubUrl);

    const { data } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: hash,
    });

    const patches = data.files
      ?.map((f) => {
        if (!f.patch) return "";
        return `diff --git a/${f.filename} b/${f.filename}\n${f.patch}`;
      })
      .filter(Boolean)
      .join("\n\n");

    return patches || "";
  } catch (error: any) {
    console.error(`❌ Failed to fetch commit diff via API:`, error.message);
    return "";
  }
}

/* ---------------- Get Commits ---------------- */
export async function getCommitHashes(
  githubUrl: string
): Promise<CommitResponse[]> {
  const { owner, repo } = parseGitHubUrl(githubUrl);

  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo,
    per_page: 30,
  });

  return data.slice(0, 15).map((c: any) => ({
    commitHash: c.sha || "",
    commitMessage: c.commit?.message || "No message",
    commitAuthorName: c.commit?.author?.name || "Unknown",
    commitAuthorAvatar: c.author?.avatar_url || "",
    commitDate: c.commit?.author?.date || new Date().toISOString(),
  }));
}

/* ---------------- Filter Pending ---------------- */
async function getPendingCommits(
  projectId: string,
  commits: CommitResponse[]
) {
  const existing = await db.commit.findMany({
    where: { projectId },
    select: { commitHash: true, summary: true },
  });

  const done = new Set(
    existing
      .filter((c) => c.summary && c.summary.trim().length > 0)
      .map((c) => c.commitHash)
  );

  return commits.filter((c) => !done.has(c.commitHash));
}

/* ---------------- Poll Commits ---------------- */
export async function pollCommits(projectId: string) {
  try {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { githubUrl: true },
    });

    if (!project?.githubUrl) {
      console.log("⚠️ No GitHub URL for project");
      return [];
    }

    const commits = await getCommitHashes(project.githubUrl);
    const pending = await getPendingCommits(projectId, commits);

    if (pending.length === 0) {
      console.log("✅ No pending commits");
      return [];
    }

    const processed: { commitHash: string }[] = [];

    // Process commits sequentially
    for (const commit of pending) {
      console.log(`📝 Processing: ${commit.commitHash.slice(0, 7)}`);

      let row = await db.commit.findFirst({
        where: { projectId, commitHash: commit.commitHash },
      });

      if (!row) {
        row = await db.commit.create({
          data: {
            projectId,
            commitHash: commit.commitHash,
            commitMessage: commit.commitMessage,
            commitAuthorName: commit.commitAuthorName,
            commitAuthorAvatar: commit.commitAuthorAvatar,
            commitDate: new Date(commit.commitDate),
            summary: "",
          },
        });
        console.log(`✅ Created commit record: ${row.id}`);
      }

      if (!row.summary || row.summary.trim().length === 0) {
        try {
          const diff = await fetchDiff(project.githubUrl, commit.commitHash);

          if (!diff || diff.length < 20) {
            console.log("⚠️ Empty/small diff, skipping");
            await db.commit.update({
              where: { id: row.id },
              data: { summary: "No significant changes" },
            });
            continue;
          }

          console.log("🤖 Generating summary...");
          const summary = await aiSummariseCommit(diff);

          await db.commit.update({
            where: { id: row.id },
            data: { summary },
          });

          console.log(`✅ Summary saved: ${commit.commitHash.slice(0, 7)}`);
          processed.push({ commitHash: commit.commitHash });

          // Note: Credit deduction for commit analysis happens during indexing
        } catch (err: any) {
          console.error(`❌ Summary failed: ${err.message}`);

          await db.commit.update({
            where: { id: row.id },
            data: { summary: `Error: ${err.message}` },
          });
        }
      }
    }

    return processed;
  } catch (error: any) {
    console.error(`❌ pollCommits error: ${error.message}`);
    return [];
  }
}
