'use server'

import { generateEmbedding } from "@/lib/embeddings"
import {
  generateCodeQAResponse,
  generateCommitQAResponse,
} from "@/lib/ai-service"
import { db } from "@/server/db"
import { auth } from "@clerk/nextjs/server"
import { consumeCredits, InsufficientCreditsError } from "@/lib/credit-service"

function isCommitQuestion(question: string) {
  const q = question.toLowerCase()
  return (
    q.includes("commit") ||
    q.includes("which commit") ||
    q.includes("commit modified") ||
    q.includes("commit changed")
  )
}

function truncateCode(code: string, maxChars = 2800) {
  return code.length > maxChars
    ? code.slice(0, maxChars) + "\n/* truncated */"
    : code
}

export async function askQuestion(
  question: string,
  projectId: string
): Promise<{
  answer: string
  filesReferences: {
    fileName: string
    sourceCode: string
    summary: string
    similarity: number
  }[]
}> {
  console.log("Question:", question)

  const { userId } = await auth()
  if (!userId) {
    return { answer: "You must be logged in.", filesReferences: [] }
  }

  try {
    await consumeCredits(
      userId,
      "QUESTION_ASKED",
      projectId,
      question.slice(0, 50)
    )
    console.log("Credits deducted")
  } catch (error: any) {
    if (error instanceof InsufficientCreditsError) {
      return {
        answer: "Insufficient credits. Please purchase more!",
        filesReferences: [],
      }
    }
    throw error
  }

  if (isCommitQuestion(question)) {
    console.log("Searching commit history...")

    const commits = await db.commit.findMany({
      where: {
        projectId,
        summary: {
          not: "",
          notIn: [
            "Generating summary...",
            "Pending",
            "Retry pending (attempt 1/3)",
            "Retry pending (attempt 2/3)",
            "Retry pending (attempt 3/3)",
          ],
        },
      },
      orderBy: { commitDate: "desc" },
      take: 15,
    })

    if (!commits.length) {
      return {
        answer: "No commit summaries available yet. Please check back in a few minutes.",
        filesReferences: [],
      }
    }

    const context = commits
      .map(
        (c) => `
COMMIT: ${c.commitHash}
DATE: ${c.commitDate.toLocaleString()}
AUTHOR: ${c.commitAuthorName}
MESSAGE: ${c.commitMessage}
CHANGES:
${c.summary}
`.trim()
      )
      .join("\n\n---\n\n")

    const answer = await generateCommitQAResponse(context, question)

    return {
      answer,
      filesReferences: [],
    }
  }

  try {
    console.log("Searching codebase...")

    const embeddingCount = await db.sourceCodeEmbedding.count({
      where: { projectId },
    })

    if (embeddingCount === 0) {
      return {
        answer: "The codebase is still being indexed. Please wait a few minutes and try again.",
        filesReferences: [],
      }
    }

    console.log(`Found ${embeddingCount} files in index`)
    console.log("Generating query embedding...")

    const queryVector = await generateEmbedding(question)

    if (!queryVector.length || queryVector.length !== 1536) {
      console.error("Invalid embedding dimensions:", queryVector.length)
      return {
        answer: "Failed to process question.",
        filesReferences: [],
      }
    }

    console.log("Query embedding generated")
    console.log("Performing vector similarity search...")

    let files: any[] = []

    try {
      const vectorString = `[${queryVector.join(",")}]`

      files = await db.$queryRaw`
        SELECT
          "fileName",
          "sourceCode",
          "summary",
          1 - ("summaryEmbedding" <=> ${vectorString}::vector) AS similarity
        FROM "SourceCodeEmbedding"
        WHERE "projectId" = ${projectId}
          AND "summaryEmbedding" IS NOT NULL
          AND array_length(regexp_split_to_array("summaryEmbedding"::text, ','), 1) = 1536
          AND 1 - ("summaryEmbedding" <=> ${vectorString}::vector) > 0.25
        ORDER BY similarity DESC
        LIMIT 8
      `
      console.log(`Found ${files.length} relevant files via vector search`)
    } catch (dbError: any) {
      console.error("Vector search failed:", dbError.message)
      console.log("Falling back to text search...")

      const keywords = question
        .toLowerCase()
        .split(" ")
        .filter((w) => w.length > 3)

      const fallbackFiles = await db.sourceCodeEmbedding.findMany({
        where: {
          projectId,
          OR: [
            ...keywords.map((kw) => ({
              fileName: { contains: kw, mode: "insensitive" as const },
            })),
            ...keywords.map((kw) => ({
              summary: { contains: kw, mode: "insensitive" as const },
            })),
          ],
        },
        take: 8,
        select: {
          fileName: true,
          sourceCode: true,
          summary: true,
        },
      })

      files = fallbackFiles.map((f) => ({ ...f, similarity: 0.4 }))
      console.log(`Found ${files.length} files via keyword search`)
    }

    if (!files.length) {
      console.log("No matching files found")
      return {
        answer:
          "Not found in the codebase. The repository may still be indexing.",
        filesReferences: [],
      }
    }

    console.log(`Building context from ${files.length} files`)

    const context = files
      .map(
        (f) => `
FILE: ${f.fileName}
SUMMARY: ${f.summary}

CODE:
${truncateCode(f.sourceCode)}
`.trim()
      )
      .join("\n\n========================================\n\n")

    console.log("Generating AI response...")
    const answer = await generateCodeQAResponse(context, question)
    console.log("Response generated")

    return {
      answer,
      filesReferences: files.map((f) => ({
        fileName: f.fileName,
        sourceCode: f.sourceCode,
        summary: f.summary || "No summary available",
        similarity: parseFloat(f.similarity) || 0,
      })),
    }
  } catch (error: any) {
    console.error("Q&A processing failed:", error.message)
    console.error("Stack:", error.stack)

    return {
      answer:
        "An error occurred while processing your question. The repository may still be indexing.",
      filesReferences: [],
    }
  }
}




