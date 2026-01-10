import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Document } from "@langchain/core/documents";
import { generateEmbeddings } from "@/lib/embeddings";
import { summariseCode } from "@/lib/ai-service";
import { db } from "@/server/db";
import pLimit from "p-limit";

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

type PreparedEmbedding = {
  fileName: string;
  sourceCode: string;
  summary: string;
  embedding: number[];
};

async function generateEmbeddingsOptimized(
  docs: Document[],
  projectId: string
): Promise<PreparedEmbedding[]> {
  const results: PreparedEmbedding[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);

    try {
      const cached = await Promise.all(
        batch.map(async (doc) => {
          const fileName = String(doc.metadata?.source ?? "");
          const sourceCode = String(doc.pageContent ?? "");

          const existing = await db.sourceCodeEmbedding.findFirst({
            where: { projectId, fileName, sourceCode },
            select: { id: true, summary: true },
          });

          return existing?.summary?.length ? existing : null;
        })
      );

      const uncachedDocs = batch.filter((_, idx) => !cached[idx]);

      if (uncachedDocs.length === 0) {
        continue;
      }

      const summaries = await Promise.all(
        uncachedDocs.map((doc) => summariseCode(doc))
      );

      const embeddings = await generateEmbeddings(summaries);

      uncachedDocs.forEach((doc, idx) => {
        if (embeddings[idx]?.length === 384) {
          results.push({
            fileName: String(doc.metadata?.source ?? ""),
            sourceCode: String(doc.pageContent ?? ""),
            summary: summaries[idx] || "",
            embedding: embeddings[idx]!,
          });
        }
      });

      if (i + BATCH_SIZE < docs.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error: any) {}
  }

  return results;
}

export async function indexGithubRepo(
  projectId: string,
  githubUrl: string
) {
  const docs = await loadGithubRepo(githubUrl);

  if (!docs.length) {
    return;
  }

  const prepared = await generateEmbeddingsOptimized(docs, projectId);

  if (!prepared.length) {
    return;
  }

  for (const item of prepared) {
    try {
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

      const vector = `[${item.embedding.join(",")}]`;

      await db.$executeRawUnsafe(`
        UPDATE "SourceCodeEmbedding"
        SET "summaryEmbedding" = '${vector}'::vector
        WHERE "id" = '${record.id}'
      `);
    } catch (error: any) {}
  }
}

