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

/**
 * Fetch latest commits from a GitHub repository.
 */
export const getCommitHashes = async (githubUrl: string): Promise<CommitResponse[]> => {
  try {
    const parts = githubUrl.split("/").filter(Boolean);
    const owner = parts[parts.length - 2];
    const repo = parts[parts.length - 1];
    

    if (!owner || !repo) throw new Error("Invalid GitHub repository URL.");

    const { data } = await octokit.rest.repos.listCommits({ owner, repo, per_page: 30 });

    const sortedCommits = data.sort(
      (a: any, b: any) =>
        new Date(b.commit.author?.date ?? 0).getTime() -
        new Date(a.commit.author?.date ?? 0).getTime()
    ) as any[];

    return sortedCommits.slice(0, 15).map((commit: any) => ({
      commitHash: commit.sha ?? "",
      commitMessage: commit.commit?.message ?? "",
      commitAuthorName: commit.commit?.author?.name ?? "Unknown",
      commitAuthorAvatar: commit.author?.avatar_url ?? "",
      commitDate: commit.commit?.author?.date ?? new Date().toISOString(),
    }));
  } catch (error: any) {
    console.error("❌ Error fetching commit hashes:", error.message);
    throw new Error("Failed to fetch commits from GitHub.");
  }
};

/**
 * Fetch a project's GitHub URL by its ID.
 */
async function fetchProjectGithubUrl(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { githubUrl: true },
  });

  if (!project?.githubUrl) {
    throw new Error("Project has no GitHub URL");
  }

  return project.githubUrl;
}

/**
 * Filter out commits that have already been processed.
 */
async function filterUnprocessedCommits(projectId: string, commits: CommitResponse[]) {
  const processed = await db.commit.findMany({
    where: { projectId },
    select: { commitHash: true },
  });

  const processedHashes = new Set(processed.map((c) => c.commitHash));

  return commits.filter((commit) => !processedHashes.has(commit.commitHash));
}

/**
 * Fetch the .diff for a commit and summarise it using AI.
 */
async function summariseCommit(githubUrl: string, commitHash: string) {
  try {
    const diffUrl = `${githubUrl}/commit/${commitHash}.diff`;

    const { data } = await axios.get(diffUrl, {
      headers: { Accept: "application/vnd.github.v3.diff" },
    });

    const summary = await aiSummariseCommit(data);
    return summary || "";
  } catch (error: any) {
    console.error(`❌ Error summarising commit ${commitHash}:`, error.message);
    return "";
  }
}

/**
 * Poll new commits, summarise them, and insert them into the database.
 */
export const pollCommits = async (projectId: string) => {
  const githubUrl = await fetchProjectGithubUrl(projectId);
  const commitHashes = await getCommitHashes(githubUrl);
  const unprocessedCommits = await filterUnprocessedCommits(projectId, commitHashes);

  if (unprocessedCommits.length === 0) {
    console.log("✅ No new commits to process.");
    return [];
  }

  console.log(`🧠 Found ${unprocessedCommits.length} new commits to summarise.`);

  const summaryResponses = await Promise.allSettled(
    unprocessedCommits.map((commit) => summariseCommit(githubUrl, commit.commitHash))
  );

  const summaries = summaryResponses.map((res) =>
    res.status === "fulfilled" ? res.value : ""
  );

  const commits = await db.commit.createMany({
    data: summaries.map((summary, idx) => ({
      projectId: projectId,
      commitHash: unprocessedCommits[idx]!.commitHash,
      summary: summary!,
      commitAuthorName: unprocessedCommits[idx]!.commitAuthorName,
      commitDate: unprocessedCommits[idx]!.commitDate,
      commitMessage: unprocessedCommits[idx]!.commitMessage,
      commitAuthorAvatar: unprocessedCommits[idx]!.commitAuthorAvatar,
    })),
  });
  return commits;
};