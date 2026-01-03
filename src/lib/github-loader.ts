// src/lib/github-loader.ts
import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Document } from "@langchain/core/documents";
import { generateEmbedding, summariseCode } from "./ai-service";
import { db } from "@/server/db";
import pLimit from "p-limit";

/* ---------------- Normalize GitHub URL ---------------- */
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

/* ---------------- Load GitHub Repo ---------------- */
export const loadGithubRepo = async (
  githubUrl: string
): Promise<Document[]> => {
  console.log("📥 Loading GitHub repository:", githubUrl);

  try {
    const cleanUrl = normalizeGithubUrl(githubUrl);
    console.log("🔗 Normalized URL:", cleanUrl);

    const url = new URL(cleanUrl);
    const [, owner, repo] = url.pathname.split("/");

    if (!owner || !repo) {
      throw new Error("Invalid GitHub URL. Use: https://github.com/owner/repo");
    }

    console.log(`👤 Owner: ${owner}, 📦 Repo: ${repo}`);

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN not set in .env");
    }

    const loader = new GithubRepoLoader(cleanUrl, {
      accessToken: token,
      branch: "main",
      recursive: true,
      ignoreFiles: [
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "bun.lockb",
        "*.min.js",
        "*.map",
        "*.csv",
        "*.json",
        "*.png",
        "*.jpg",
        "*.gif",
        "*.svg",
        "*.ico",
        "*.woff*",
        "*.ttf",
        "*.eot",
      ],
      unknown: "warn",
      maxConcurrency: 2,
    });

    const docs = await loader.load();
    console.log(`✅ Loaded ${docs.length} files`);

    const filtered = docs.filter((doc) => {
      const path = doc.metadata.source.toLowerCase();
      return (
        /\.(ts|tsx|js|jsx|mdx|html|css|md)$/i.test(path) &&
        !path.includes("node_modules") &&
        !path.includes(".next") &&
        !path.includes("dist") &&
        !path.includes("build") &&
        !path.includes(".git")
      );
    });

    console.log(`✅ Filtered to ${filtered.length} code files`);

    if (filtered.length === 0) {
      console.warn("⚠️ No code files found");
    }

    return filtered;
  } catch (error: any) {
    console.error("❌ GitHub loading error:", error.message);
    throw error;
  }
};

/* ---------------- Generate Embeddings ---------------- */
const generateEmbeddings = async (docs: Document[]) => {
  console.log(`🤖 Generating embeddings for ${docs.length} files...`);

  const limit = pLimit(1);
  let successCount = 0;
  let failCount = 0;

  const results = await Promise.allSettled(
    docs.map((doc, index) =>
      limit(async () => {
        try {
          console.log(`[${index + 1}/${docs.length}] Processing: ${doc.metadata.source}`);

          const summary = await summariseCode(doc);

          // ✅ Accept any non-empty summary
          if (!summary || summary.length === 0) {
            console.warn(`⚠️ Empty summary: ${doc.metadata.source}`);
            return null;
          }

          const embedding = await generateEmbedding(summary);

          // ✅ Reject invalid embeddings explicitly
          if (!embedding || embedding.length !== 1536) {
            console.warn(
              `⚠️ Invalid embedding (${embedding.length}) for ${doc.metadata.source}`
            );
            return null;
          }

          successCount++;
          console.log(`✅ [${successCount}/${docs.length}] ${doc.metadata.source}`);

          return {
            summary,
            embedding,
            sourceCode: String(doc.pageContent),
            fileName: doc.metadata.source,
          };
        } catch (error: any) {
          failCount++;
          console.error(
            `❌ [${index + 1}/${docs.length}] ${doc.metadata.source}:`,
            error.message
          );
          return null;
        }
      })
    )
  );

  const embeddings = results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  console.log(`📊 Results: ${successCount} success, ${failCount} failed`);
  return embeddings;
};

/* ---------------- Index GitHub Repo ---------------- */
export const indexGithubRepo = async (
  projectId: string,
  githubUrl: string
) => {
  console.log("🚀 Starting repository indexing...");
  console.log(`📦 Project: ${projectId}`);
  console.log(`🔗 GitHub: ${githubUrl}`);

  try {
    const docs = await loadGithubRepo(githubUrl);

    if (docs.length === 0) {
      console.warn("⚠️ No files to index");
      return;
    }

    const allEmbeddings = await generateEmbeddings(docs);

    if (allEmbeddings.length === 0) {
      console.error("❌ No embeddings generated");
      return;
    }

    const limit = pLimit(1);
    let savedCount = 0;

    console.log(`💾 Saving ${allEmbeddings.length} embeddings...`);

    await Promise.allSettled(
      allEmbeddings.map((embedding) =>
        limit(async () => {
          try {
            const record = await db.sourceCodeEmbedding.create({
              data: {
                summary: embedding.summary,
                sourceCode: embedding.sourceCode,
                fileName: embedding.fileName,
                projectId,
              },
            });

            const vectorLiteral = `[${embedding.embedding.join(",")}]`;
            await db.$executeRawUnsafe(
              `UPDATE "SourceCodeEmbedding"
               SET "summaryEmbedding" = '${vectorLiteral}'::vector
               WHERE "id" = '${record.id}'`
            );

            savedCount++;
            console.log(`💾 [${savedCount}/${allEmbeddings.length}] Saved: ${embedding.fileName}`);
          } catch (error: any) {
            console.error(`❌ Save failed: ${embedding.fileName}`, error.message);
          }
        })
      )
    );

    console.log(`✅ Indexing complete! ${savedCount}/${allEmbeddings.length} files saved`);
  } catch (error: any) {
    console.error("❌ Indexing failed:", error.message);
    throw error;
  }
};
