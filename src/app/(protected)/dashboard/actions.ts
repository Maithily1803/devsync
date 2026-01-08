'use server'
import { generateEmbedding } from "@/lib/embeddings"
import {
  generateCodeQAResponse,
  generateCommitQAResponse,
} from "@/lib/ai-service"
import { db } from "@/server/db"
import { auth } from "@clerk/nextjs/server"
import { consumeCredits } from "@/lib/credit-service"

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

//auth

  const { userId } = await auth()
  if (!userId) {
    return { answer: "You must be logged in.", filesReferences: [] }
  }

//credits

  await consumeCredits(
    userId,
    "QUESTION_ASKED",
    projectId,
    question.slice(0, 50)
  )

//commit quest

  if (isCommitQuestion(question)) {
    const commits = await db.commit.findMany({
      where: {
        projectId,
        summary: { not: "" },
      },
      orderBy: { commitDate: "desc" },
      take: 10,
    })

    if (!commits.length) {
      return {
        answer: "No commit summaries available yet.",
        filesReferences: [],
      }
    }

    const context = commits
      .map(
        (c) => `
COMMIT: ${c.commitHash.slice(0, 7)}
MESSAGE: ${c.commitMessage}
SUMMARY:
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

//code quest

  const queryVector = await generateEmbedding(question)
  if (!queryVector.length) {
    return {
      answer: "Unable to process this question.",
      filesReferences: [],
    }
  }

  const vectorQuery = `[${queryVector.join(",")}]`

  const files = (await db.$queryRaw`
    SELECT
      "fileName",
      "sourceCode",
      "summary",
      1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) AS similarity
    FROM "SourceCodeEmbedding"
    WHERE "projectId" = ${projectId}
      AND 1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) > 0.25
    ORDER BY similarity DESC
    LIMIT 6
  `) as any[]

  if (!files.length) {
    return {
      answer: "Not found in the codebase.",
      filesReferences: [],
    }
  }

  const context = files
    .map(
      (f) => `
FILE: ${f.fileName}

${truncateCode(f.sourceCode)}
`.trim()
    )
    .join("\n\n----------------\n\n")

  const answer = await generateCodeQAResponse(context, question)

  return {
    answer,
    filesReferences: files,
  }
}


