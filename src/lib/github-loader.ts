// src/lib/github-loader.ts
import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Document } from "@langchain/core/documents";
import { generateEmbedding, summariseCode } from "./gemini";
import { db } from "@/server/db";
import pLimit from "p-limit";

export const loadGithubRepo = async (githubUrl: string, githubToken?: string) => {
  const loader = new GithubRepoLoader(githubUrl, {
    accessToken: githubToken || "",
    branch: "main",
    ignoreFiles: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"],
    recursive: true,
    unknown: "warn",
    maxConcurrency: 5,
  });
  const docs = await loader.load();
  const filteredDocs = docs.filter(doc =>
    /\.(ts|tsx|js|jsx|mdx|html)$/i.test(doc.metadata.source)
  );

  return filteredDocs;
};

export const indexGithubRepo = async (projectId: string, githubUrl: string, githubToken?: string) => {
  const docs = await loadGithubRepo(githubUrl, githubToken);
  const allEmbeddings = await generateEmbeddings(docs);

const limit = pLimit(2); // Limit concurrency to avoid 429 errors

await Promise.allSettled(
  allEmbeddings.map((embedding, index) =>
    limit(async () => {
      console.log(`Processing ${index + 1} of ${allEmbeddings.length}`);

      if (!embedding || !embedding.embedding || embedding.embedding.length === 0) {
        console.warn(`⚠️ Skipping file ${embedding?.fileName} — empty embedding`);
        return;
      }

      const sourceCodeEmbedding = await db.sourceCodeEmbedding.create({
        data: {
          summary: embedding.summary,
          sourceCode: embedding.sourceCode,
          fileName: embedding.fileName,
          projectId,
        },
      });

      // Convert JS array → SQL vector literal
      const vectorLiteral = `[${embedding.embedding.join(",")}]`;

      await db.$executeRawUnsafe(
        `UPDATE "SourceCodeEmbedding"
         SET "summaryEmbedding" = '${vectorLiteral}'::vector
         WHERE "id" = '${sourceCodeEmbedding.id}'`
      );
    })
  )
);
};

const generateEmbeddings = async (docs: Document[]) => {
  return await Promise.all(
    docs.map(async (doc) => {
      const summary = await summariseCode(doc);
      const embedding = await generateEmbedding(summary);
      return {
        summary,
        embedding,
        sourceCode: JSON.parse(JSON.stringify(doc.pageContent)),
        fileName: doc.metadata.source,
      };
    })
  );
};
