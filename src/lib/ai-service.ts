import Groq from "groq-sdk"
import type { Document } from "@langchain/core/documents"
import { retryWithBackoff } from "@/lib/retry-helper"

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
})

export const AI_MODELS = {
  PRIMARY: "llama-3.1-8b-instant",
} as const

function truncate(text: string, maxChars: number) {
  if (!text) return ""
  return text.length > maxChars ? text.slice(0, maxChars) : text
}

const COMMIT_SYSTEM_PROMPT = `You are a git diff summarizer. Output ONLY 2-3 concise bullet points describing what changed.

Rules:
- Start directly with bullets (•)
- NO preambles or explanations
- NO "Here are the changes" text
- Be specific about what was modified

Example:
• Added user authentication with JWT tokens
• Refactored database connection pooling
• Fixed memory leak in image processing`

const CODE_SYSTEM_PROMPT =
  "Summarize the code's purpose and behavior in 2-3 concise technical sentences. Focus on what the code does, not how it's structured."

const CODE_QA_SYSTEM_PROMPT = `You are a helpful code assistant. Answer questions using ONLY the provided code context.

Rules:
- List relevant file paths clearly
- Explain what the code does in simple terms
- If multiple files match, list them all
- Say "Not found in the codebase" ONLY if zero matches exist
- Be conversational and helpful`

const COMMIT_QA_SYSTEM_PROMPT = `You are a helpful git history assistant. Answer questions about commits in a user-friendly way.

Rules:
- Reference commits by their MESSAGE, not hash
- Format: "In the commit titled '[MESSAGE]', ..."
- Include dates when relevant
- Be conversational and clear
- Only mention commit hashes if specifically asked
- Say "Not found in commit history" if no matches exist

Example:
"The audio logic was added in the commit titled 'fix: address mobile audio context issues' on September 27th. This commit resolved issues with audio playback on mobile devices."

NOT: "The audio logic is in commit 7480a07."`

export async function aiSummariseCommit(diff: string): Promise<string> {
  if (!diff || diff.length < 20) {
    console.log("Diff too short, skipping")
    return "No significant changes."
  }

  const truncatedDiff = truncate(diff, 3000)

  try {
    console.log("Calling Groq API...")

    const resp = await retryWithBackoff(
      () =>
        groq.chat.completions.create({
          model: AI_MODELS.PRIMARY,
          messages: [
            { role: "system", content: COMMIT_SYSTEM_PROMPT },
            { role: "user", content: truncatedDiff },
          ],
          temperature: 0,
          max_tokens: 120,
        }),
      2,
      5000
    )

    let summary = resp.choices[0]?.message?.content?.trim() ?? ""

    summary = summary
      .replace(
        /^(here are (the changes?|what changed)|changes made|summary):\s*/i,
        ""
      )
      .replace(/^in \d+ bullets?:\s*/i, "")
      .trim()

    if (summary && !summary.startsWith("•") && !summary.startsWith("-")) {
      const lines = summary.split("\n").filter(Boolean)
      summary = lines
        .map((line) => {
          const trimmed = line.trim()
          if (trimmed.startsWith("•") || trimmed.startsWith("-"))
            return trimmed
          return `• ${trimmed}`
        })
        .join("\n")
    }

    console.log("Summary generated successfully")
    return summary || "• Minor refactoring and code improvements"
  } catch (error: any) {
    console.error("Commit summary failed:", error.message)

    const errorMsg = error.message?.toLowerCase() || ""
    const isRateLimit =
      errorMsg.includes("rate limit") ||
      errorMsg.includes("429") ||
      errorMsg.includes("too many requests")

    if (isRateLimit) {
      console.error("Rate limited")
      throw new Error("RATE_LIMIT_PERMANENT")
    }

    throw error
  }
}

export async function summariseCode(doc: Document): Promise<string> {
  const code = truncate(String(doc.pageContent ?? ""), 2500)
  if (code.length < 50) return "Minimal or non-functional code."

  try {
    const resp = await retryWithBackoff(
      () =>
        groq.chat.completions.create({
          model: AI_MODELS.PRIMARY,
          messages: [
            { role: "system", content: CODE_SYSTEM_PROMPT },
            { role: "user", content: code },
          ],
          temperature: 0.2,
          max_tokens: 120,
        }),
      2,
      3000
    )

    return (
      resp.choices[0]?.message?.content?.trim() ?? "Summary unavailable."
    )
  } catch (error: any) {
    console.error("Code summary failed:", error.message)
    return "Summary unavailable."
  }
}

export async function generateCodeQAResponse(
  context: string,
  question: string
): Promise<string> {
  if (!context || context.length < 50) {
    return "Not found in the codebase."
  }

  try {
    const resp = await retryWithBackoff(
      () =>
        groq.chat.completions.create({
          model: AI_MODELS.PRIMARY,
          messages: [
            { role: "system", content: CODE_QA_SYSTEM_PROMPT },
            {
              role: "user",
              content: `CODE CONTEXT:\n${truncate(
                context,
                7000
              )}\n\nQUESTION:\n${truncate(question, 300)}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      2,
      3000
    )

    return (
      resp.choices[0]?.message?.content?.trim() ??
      "Not found in the codebase."
    )
  } catch (error: any) {
    console.error("Code Q&A failed:", error.message)
    return "Unable to answer at this time. Please try again."
  }
}

export async function generateCommitQAResponse(
  context: string,
  question: string
): Promise<string> {
  try {
    const resp = await retryWithBackoff(
      () =>
        groq.chat.completions.create({
          model: AI_MODELS.PRIMARY,
          messages: [
            { role: "system", content: COMMIT_QA_SYSTEM_PROMPT },
            {
              role: "user",
              content: `COMMIT HISTORY:\n${truncate(
                context,
                7000
              )}\n\nQUESTION:\n${truncate(question, 300)}`,
            },
          ],
          temperature: 0.2,
          max_tokens: 400,
        }),
      2,
      3000
    )

    return (
      resp.choices[0]?.message?.content?.trim() ??
      "Not found in commit history."
    )
  } catch (error: any) {
    console.error("Commit Q&A failed:", error.message)
    return "Unable to search commit history at this time."
  }
}



