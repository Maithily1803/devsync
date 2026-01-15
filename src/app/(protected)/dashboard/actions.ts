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

  // Handle commit-related questions
  if (isCommitQuestion(question)) {
    const commits = await db.commit.findMany({
      where: {
        projectId,
        summary: { 
          not: "",
          notIn: ["Generating summary...", "Pending"]
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

  // Handle code-related questions
  try {
    console.log("Generating query embedding...")
    const queryVector = await generateEmbedding(question)
    
    if (!queryVector.length || queryVector.length !== 1536) {
      console.error("Invalid embedding dimensions:", queryVector.length)
      return {
        answer: "Failed to process question. Please try again.",
        filesReferences: [],
      }
    }

    console.log("Searching codebase with vector similarity...")
    
    // FIXED: Proper vector casting and error handling
    const vectorString = `[${queryVector.join(",")}]`
    
    let files: any[] = []
    
    try {
      files = await db.$queryRaw`
        SELECT
          "fileName",
          "sourceCode",
          "summary",
          1 - ("summaryEmbedding" <=> ${vectorString}::vector) AS similarity
        FROM "SourceCodeEmbedding"
        WHERE "projectId" = ${projectId}
          AND "summaryEmbedding" IS NOT NULL
          AND 1 - ("summaryEmbedding" <=> ${vectorString}::vector) > 0.3
        ORDER BY similarity DESC
        LIMIT 8
      `
    } catch (dbError: any) {
      console.error("Database query failed:", dbError.message)
      
      // Fallback: simple text search if vector search fails
      const fallbackFiles = await db.sourceCodeEmbedding.findMany({
        where: {
          projectId,
          OR: [
            { fileName: { contains: question, mode: 'insensitive' } },
            { summary: { contains: question, mode: 'insensitive' } },
          ]
        },
        take: 5,
        select: {
          fileName: true,
          sourceCode: true,
          summary: true,
        }
      })
      
      files = fallbackFiles.map(f => ({ ...f, similarity: 0.5 }))
    }

    if (!files.length) {
      return {
        answer: "Not found in the codebase. Try rephrasing your question or check if the repository has been fully indexed.",
        filesReferences: [],
      }
    }

    console.log(`Found ${files.length} relevant files`)

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

    const answer = await generateCodeQAResponse(context, question)

    return {
      answer,
      filesReferences: files.map(f => ({
        fileName: f.fileName,
        sourceCode: f.sourceCode,
        summary: f.summary || "No summary available",
        similarity: parseFloat(f.similarity) || 0
      })),
    }
  } catch (error: any) {
    console.error("Q&A processing failed:", error.message)
    console.error("Stack:", error.stack)
    
    return {
      answer: "An error occurred while processing your question. Please try again.",
      filesReferences: [],
    }
  }
}



