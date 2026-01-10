import { Octokit } from "@octokit/rest";
import { db } from "@/server/db";
import { aiSummariseCommit } from "./ai-service";
import { retryWithBackoff } from "./retry-helper";

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

function parseGitHubUrl(url: string) {
  const u = new URL(url);
  const [owner, repo] = u.pathname.replace(/^\/|\.git$/g, "").split("/");
  if (!owner || !repo) throw new Error("Invalid GitHub URL");
  return { owner, repo };
}

async function fetchDiff(githubUrl: string, hash: string): Promise<string> {
  try {
    const { owner, repo } = parseGitHubUrl(githubUrl);

    const { data } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: hash,
    });

    const patches =
      data.files
        ?.slice(0, 5)
        .map((f) => {
          if (!f.patch) return "";
          const patch = f.patch.slice(0, 1500);
          return `diff --git a/${f.filename} b/${f.filename}\n${patch}`;
        })
        .filter(Boolean)
        .join("\n\n") ?? "";

    return patches;
  } catch (error: any) {
    console.error("Failed to fetch commit diff:", error.message);
    return "";
  }
}

export async function getCommitHashes(
  githubUrl: string
): Promise<CommitResponse[]> {
  const { owner, repo } = parseGitHubUrl(githubUrl);

  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo,
    per_page: 20,
  });

  return data.slice(0, 15).map((c: any) => ({
    commitHash: c.sha,
    commitMessage: c.commit?.message ?? "No message",
    commitAuthorName: c.commit?.author?.name ?? "Unknown",
    commitAuthorAvatar: c.author?.avatar_url ?? "",
    commitDate: c.commit?.author?.date ?? new Date().toISOString(),
  }));
}

async function getPendingCommits(
  projectId: string,
  commits: CommitResponse[]
) {
  const existing = await db.commit.findMany({
    where: { projectId },
    select: { commitHash: true, summary: true, retryCount: true },
  });

  const completed = new Set<string>();

  for (const c of existing) {
    const hasValidSummary =
      c.summary &&
      c.summary.trim() !== "" &&
      c.summary !== "Pending" &&
      !c.summary.startsWith("No significant") &&
      !c.summary.includes("Summary unavailable");

    const maxRetriesReached = (c.retryCount || 0) >= 3;

    if (hasValidSummary || maxRetriesReached) {
      completed.add(c.commitHash);
    }
  }

  return commits.filter((c) => !completed.has(c.commitHash));
}

export async function pollCommits(projectId: string) {
  try {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { githubUrl: true },
    });

    if (!project?.githubUrl) return [];

    const commits = await getCommitHashes(project.githubUrl);
    const pending = await getPendingCommits(projectId, commits);

    if (pending.length === 0) {
      return [];
    }

    const processed: { commitHash: string }[] = [];

    for (const commit of pending) {
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
            summary: "Pending",
          },
        });
      }

      const currentRetries = row.retryCount || 0;

      if (currentRetries >= 3) {
        continue;
      }

      if (
        row.summary &&
        row.summary !== "Pending" &&
        !row.summary.startsWith("No significant") &&
        !row.summary.includes("Summary unavailable") &&
        !row.summary.includes("failed due to rate limits")
      ) {
        continue;
      }

      const diff = await fetchDiff(project.githubUrl, commit.commitHash);

      if (!diff || diff.length < 50) {
        await db.commit.update({
          where: { id: row.id },
          data: { summary: "No significant code changes." },
        });
        continue;
      }

      try {
        const summary = await retryWithBackoff(() =>
          aiSummariseCommit(diff)
        );

        await db.commit.update({
          where: { id: row.id },
          data: {
            summary: summary || "Minor refactor / formatting changes.",
            retryCount: 0,
          },
        });

        processed.push({ commitHash: commit.commitHash });
      } catch (err: any) {
        console.error(
          `Summary failed for ${commit.commitHash.slice(0, 7)}:`,
          err.message
        );

        const newRetryCount = (row.retryCount || 0) + 1;

        await db.commit.update({
          where: { id: row.id },
          data: {
            summary:
              newRetryCount >= 3
                ? "Summary generation permanently failed after 3 attempts."
                : `Summary generation failed (attempt ${newRetryCount}/3). Will retry.`,
            retryCount: newRetryCount,
          },
        });
      }

      await new Promise((r) => setTimeout(r, 2000));
    }

    return processed;
  } catch (error: any) {
    console.error("pollCommits failed:", error.message);
    return [];
  }
}


