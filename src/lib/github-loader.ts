import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Document } from "@langchain/core/documents";
import { generateEmbedding, summariseCode } from "./gemini";
import { db } from "@/server/db";
import pLimit from "p-limit";

//load github docs 
export const loadGithubRepo = async (
  githubUrl: string, 
  githubToken?: string
): Promise<Document[]> => {
  console.log("Loading GitHub repository:", githubUrl);

  try {
    const loader = new GithubRepoLoader(githubUrl, {
      accessToken: githubToken || "",
      branch: "main",
      ignoreFiles: [
        //lock files
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "bun.lockb",
        //build artifacts
        "*.min.js",
        "*.map",
        //large data files
        "*.csv",
        "*.json",
        //images
        "*.png",
        "*.jpg",
        "*.gif",
        "*.svg",
        "*.ico",
      ],
      recursive: true,
      unknown: "warn",
      maxConcurrency: 5,
    });

    const docs = await loader.load();
    console.log(`Loaded ${docs.length} files from repository`);

    // filter relevant file types
    const filteredDocs = docs.filter(doc => {
      const path = doc.metadata.source.toLowerCase();
      return (
        /\.(ts|tsx|js|jsx|mdx|html|css|md)$/i.test(path) &&
        !path.includes('node_modules') &&
        !path.includes('.next') &&
        !path.includes('dist') &&
        !path.includes('build')
      );
    });

    console.log(`Filtered to ${filteredDocs.length} relevant files`);

    return filteredDocs;

  } catch (error: any) {
    console.error("Error loading GitHub repo:", error.message);
    throw new Error(`Failed to load repository: ${error.message}`);
  }
};

//embeddings for multiple documents

const generateEmbeddings = async (docs: Document[]) => {
  console.log(`Generating embeddings for ${docs.length} files...`);
  
  const limit = pLimit(3); // Process 3 files at a time
  let successCount = 0;
  let failCount = 0;

  const results = await Promise.allSettled(
    docs.map((doc, index) =>
      limit(async () => {
        try {
          console.log(`[${index + 1}/${docs.length}] Processing ${doc.metadata.source}`);

          // generate summary
          const summary = await summariseCode(doc);
          
          if (!summary) {
            console.warn(`Empty summary for ${doc.metadata.source}`);
            return null;
          }

          // generate embedding
          const embedding = await generateEmbedding(summary);
          
          if (!embedding || embedding.length === 0) {
            console.warn(`Empty embedding for ${doc.metadata.source}`);
            return null;
          }

          successCount++;
          console.log(`[${index + 1}/${docs.length}] Success: ${doc.metadata.source}`);

          return {
            summary,
            embedding,
            sourceCode: String(doc.pageContent),
            fileName: doc.metadata.source,
          };

        } catch (error: any) {
          failCount++;
          console.error(`[${index + 1}/${docs.length}] Failed: ${doc.metadata.source}`, error.message);
          return null;
        }
      })
    )
  );

  // failed embeddings
  const embeddings = results
    .map(result => result.status === "fulfilled" ? result.value : null)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  console.log(`Embedding Results:`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total: ${embeddings.length} embeddings generated`);

  return embeddings;
};

//github repo index

export const indexGithubRepo = async (
  projectId: string,
  githubUrl: string,
  githubToken?: string
) => {
  console.log("Starting repository indexing...");
  console.log(`Project ID: ${projectId}`);
  console.log(` GitHub URL: ${githubUrl}`);

  try {
    //load documents from GitHub
    const docs = await loadGithubRepo(githubUrl, githubToken);

    if (docs.length === 0) {
      console.warn("No files found to index");
      return;
    }

    //generate embeddings
    const allEmbeddings = await generateEmbeddings(docs);

    if (allEmbeddings.length === 0) {
      console.error("No embeddings were generated successfully");
      return;
    }

    //store in database with rate limiting
    const limit = pLimit(2);
    let savedCount = 0;

    console.log(`Saving ${allEmbeddings.length} embeddings to database...`);

    const saveResults = await Promise.allSettled(
      allEmbeddings.map((embedding, index) =>
        limit(async () => {
          try {
            if (!embedding || !embedding.embedding || embedding.embedding.length === 0) {
              console.warn(`Skipping ${embedding?.fileName} - invalid embedding`);
              return;
            }

            //create the record
            const sourceCodeEmbedding = await db.sourceCodeEmbedding.create({
              data: {
                summary: embedding.summary,
                sourceCode: embedding.sourceCode,
                fileName: embedding.fileName,
                projectId,
              },
            });

            //update with vector
            const vectorLiteral = `[${embedding.embedding.join(",")}]`;
            await db.$executeRawUnsafe(
              `UPDATE "SourceCodeEmbedding"
               SET "summaryEmbedding" = '${vectorLiteral}'::vector
               WHERE "id" = '${sourceCodeEmbedding.id}'`
            );

            savedCount++;
            console.log(`[${savedCount}/${allEmbeddings.length}] Saved: ${embedding.fileName}`);

          } catch (error: any) {
            console.error(`Failed to save ${embedding.fileName}:`, error.message);
          }
        })
      )
    );

    console.log(`Indexing complete!`);
    console.log(`Results:`);
    console.log(`Saved: ${savedCount}`);
    console.log(`Failed: ${allEmbeddings.length - savedCount}`);

  } catch (error: any) {
    console.error("Indexing failed:", error.message);
    throw error;
  }
};