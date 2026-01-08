import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Document } from "@langchain/core/documents";
import { generateEmbedding } from "@/lib/embeddings";
import { summariseCode } from "@/lib/ai-service";
import { db } from "@/server/db";
import pLimit from "p-limit";

//url normalise url
function normalizeGithubUrl(url: string): string {
  let normalized = url.replace(/\.git$/i, "");

  if (!normalized.startsWith("http")) {
    normalized = "https://" + normalized;
  }

  const match = normalized.match(/github\.com[\/:]([^\/]+)\/([^\/\?#]+)/);
  if (match) {
    const [, owner, repo] = match;
    return `https://github.com/${owner}/${repo}`;
  }

  return normalized;
}

//loading repo
export async function loadGithubRepo(
  githubUrl: string
): Promise<Document[]> {
  const cleanUrl = normalizeGithubUrl(githubUrl);

  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not set");

  const loader = new GithubRepoLoader(cleanUrl, {
    accessToken: token,
    branch: "main",
    recursive: true,
    maxConcurrency: 2,
    unknown: "warn",
    ignoreFiles: [
      "node_modules",
      ".next",
      "dist",
      "build",
      "*.lock",
      "*.png",
      "*.jpg",
      "*.svg",
      "*.json",
    ],
  });

  const docs = await loader.load();

  return docs.filter((doc) => {
    const path = String(doc.metadata?.source ?? "").toLowerCase();
    return /\.(ts|tsx|js|jsx|md|css|html)$/i.test(path);
  });
}

//embedding

type PreparedEmbedding = {
  fileName: string;
  sourceCode: string;
  summary: string;
  embedding: number[];
};

async function generateEmbeddings(
  docs: Document[],
  projectId: string
): Promise<PreparedEmbedding[]> {
  const limit = pLimit(1);
  const results: PreparedEmbedding[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    if (!doc) continue;

    await limit(async () => {
      const fileName = String(doc.metadata?.source ?? "");
      const sourceCode = String(doc.pageContent ?? "");

      // cache check
      const existing = await db.sourceCodeEmbedding.findFirst({
        where: { projectId, fileName, sourceCode },
        select: { id: true, summary: true },
      });

      if (existing?.summary?.length) {
        return;
      }

      const summary = await summariseCode(doc);
      if (!summary) return;

      const embedding = await generateEmbedding(summary);
      if (embedding.length !== 384) return;

      results.push({
        fileName,
        sourceCode,
        summary,
        embedding,
      });
    });
  }

  return results;
}

//indexing repo

export async function indexGithubRepo(
  projectId: string,
  githubUrl: string
) {
  const docs = await loadGithubRepo(githubUrl);
  if (!docs.length) return;

  const prepared = await generateEmbeddings(docs, projectId);
  if (!prepared.length) return;

  for (const item of prepared) {
    const record = await db.sourceCodeEmbedding.upsert({
      where: {
        projectId_fileName: {
          projectId,
          fileName: item.fileName,
        },
      },
      update: {
        summary: item.summary,
        sourceCode: item.sourceCode,
      },
      create: {
        projectId,
        fileName: item.fileName,
        sourceCode: item.sourceCode,
        summary: item.summary,
      },
    });

    // vector must be written via raw SQL
    const vector = `[${item.embedding.join(",")}]`;

    await db.$executeRawUnsafe(`
      UPDATE "SourceCodeEmbedding"
      SET "summaryEmbedding" = '${vector}'::vector
      WHERE "id" = '${record.id}'
    `);
  }
}


