import axios from "axios";
import { Octokit } from "@octokit/rest";
import { db } from "@/server/db";
import { aiSummariseCommit } from "./gemini";

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

/* ---------------- helpers ---------------- */

function parseGitHubUrl(url: string) {
  const u = new URL(url);
  const [owner, repo] = u.pathname.replace(/^\/|\.git$/g, "").split("/");
  if (!owner || !repo) throw new Error("Invalid GitHub URL");
  return { owner, repo };
}

async function fetchDiff(githubUrl: string, hash: string) {
  const diffUrl = `${githubUrl}/commit/${hash}.diff`;
  const { data } = await axios.get(diffUrl, {
    headers: { Accept: "application/vnd.github.v3.diff" },
    timeout: 15_000,
  });
  return typeof data === "string" ? data : "";
}

/* ---------------- commits ---------------- */

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
    commitHash: c.sha,
    commitMessage: c.commit?.message ?? "",
    commitAuthorName: c.commit?.author?.name ?? "Unknown",
    commitAuthorAvatar: c.author?.avatar_url ?? "",
    commitDate: c.commit?.author?.date ?? new Date().toISOString(),
  }));
}

/**
 * Skip ONLY commits with a REAL summary
 */
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
      .filter((c) => c.summary && c.summary.length > 80)
      .map((c) => c.commitHash)
  );

  return commits.filter((c) => !done.has(c.commitHash));
}

/* ---------------- poll ---------------- */

export async function pollCommits(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { githubUrl: true },
  });

  if (!project?.githubUrl) return [];

  const commits = await getCommitHashes(project.githubUrl);
  const pending = await getPendingCommits(projectId, commits);

  if (pending.length === 0) return [];

  // STRICT: one commit per poll
  const commit = pending[0];
  if (!commit) return [];

  // 1️⃣ Ensure row exists
  let row = await db.commit.findFirst({
    where: {
      projectId,
      commitHash: commit.commitHash,
    },
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
        summary: null, 
      },
    });
  }

  // 2️⃣ Generate summary
  try {
    const diff = await fetchDiff(project.githubUrl, commit.commitHash);
    if (!diff) return [];

    const summary = await aiSummariseCommit(diff);

    await db.commit.update({
      where: { id: row.id },
      data: { summary },
    });

    return [{ commitHash: commit.commitHash }];
  } catch (err) {
    console.error("Summary failed for", commit.commitHash);
    return [];
  }
}
