// src/app/(protected)/dashboard/actions.ts
'use server'

import OpenAI from "openai"
import { generateEmbedding } from "@/lib/ai-service"
import { db } from "@/server/db"
import { auth } from "@clerk/nextjs/server"
import { consumeCredits } from "@/lib/credit-service"

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
})

function classifyQuestion(question: string) {
  const q = question.toLowerCase()

  if (q.includes("project name") || q.includes("name of this project")) {
    return "META_PROJECT_NAME"
  }

  if (
    q.includes("does this project use") ||
    q.includes("which ai") ||
    q.includes("which model")
  ) {
    return "ARCHITECTURE"
  }

  return "CODE"
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
  const questionType = classifyQuestion(question)
  let answer = ""

  console.log("❓ Question:", question)
  console.log("🧭 Question type:", questionType)

  /* ---------------- AUTH ---------------- */
  const { userId } = await auth()
  if (!userId) {
    return {
      answer: "Error: You must be logged in.",
      filesReferences: [],
    }
  }

  /* ---------------- CREDITS ---------------- */
  try {
    await consumeCredits(
      userId,
      "QUESTION_ASKED",
      projectId,
      `Asked: ${question.slice(0, 50)}...`
    )
    console.log("✅ Credits consumed successfully")
  } catch {
    return {
      answer:
        "⚠️ Insufficient credits. Please purchase more credits to continue using AI features.",
      filesReferences: [],
    }
  }

  /* ---------------- META QUESTIONS ---------------- */
  if (questionType === "META_PROJECT_NAME") {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    })

    return {
      answer: project
        ? `The project is called **${project.name}**.`
        : "I couldn't find the project name.",
      filesReferences: [],
    }
  }

  /* ---------------- CODE SEARCH ---------------- */
  let result: {
    fileName: string
    sourceCode: string
    summary: string
    similarity: number
  }[] = []

  try {
    console.log("🔍 Generating embedding...")
    const queryVector = await generateEmbedding(question)

    if (!queryVector || queryVector.length === 0) {
      throw new Error("Failed to generate embedding")
    }

    const vectorQuery = `[${queryVector.join(",")}]`

    console.log("📊 Searching codebase...")
    result = (await db.$queryRaw`
      SELECT "fileName", "sourceCode", "summary",
        1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) AS similarity
      FROM "SourceCodeEmbedding"
      WHERE 1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) > 0.25
        AND "projectId" = ${projectId}
      ORDER BY similarity DESC
      LIMIT 10
    `) as any

    console.log(`✅ Found ${result.length} relevant files`)

    if (result.length === 0) {
      return {
        answer:
          "I couldn't find relevant code files for this question.\n\n" +
          "This likely means the information is not implemented in the codebase, " +
          "or it exists only as a product or configuration detail.",
        filesReferences: [],
      }
    }

    /* ---------------- BUILD CONTEXT ---------------- */
    let context = ""
    for (const doc of result) {
      const code =
        doc.sourceCode.length > 3000
          ? doc.sourceCode.slice(0, 3000) + "\n[...truncated]"
          : doc.sourceCode

      context += `
═══════════════════════════════════
FILE: ${doc.fileName}
SUMMARY: ${doc.summary}
CODE:
${code}
═══════════════════════════════════
`
    }

    /* ---------------- AI COMPLETION ---------------- */
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a senior software engineer reviewing a codebase.

Rules:
- Answer ONLY using the provided code context
- Reference real file names
- Be precise and technical
- If the answer is not present, say so clearly
- Use markdown for code blocks`,
        },
        {
          role: "user",
          content: `CODEBASE:\n${context}\n\nQUESTION:\n${question}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    })

    answer = completion.choices[0]?.message?.content ?? ""

  } catch (err: any) {
    console.error("❌ Question error:", err.message)
    answer = `**Error:** ${err.message}`
  }

  return {
    answer,
    filesReferences: result,
  }
}
