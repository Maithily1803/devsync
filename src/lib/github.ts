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

//commit list

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
    select: { commitHash: true, summary: true },
  });

  const completed = new Set(
    existing
      .filter((c) => c.summary && !c.summary.startsWith("Pending"))
      .map((c) => c.commitHash)
  );

  return commits.filter((c) => !completed.has(c.commitHash));
}

//polling commits

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
      console.log("No pending commits");
      return [];
    }

    const processed: { commitHash: string }[] = [];

    for (const commit of pending) {
      console.log(`Processing commit ${commit.commitHash.slice(0, 7)}`);

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

      if (row.summary && row.summary !== "Pending") continue;

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
          },
        });

        processed.push({ commitHash: commit.commitHash });
      } catch (err: any) {
        console.error("Commit summary failed:", err.message);

        await db.commit.update({
          where: { id: row.id },
          data: { summary: "Pending" },
        });
      }

      // throttle
      await new Promise((r) => setTimeout(r, 2000));
    }

    return processed;
  } catch (error: any) {
    console.error("pollCommits failed:", error.message);
    return [];
  }
}
