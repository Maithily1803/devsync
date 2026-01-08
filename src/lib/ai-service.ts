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

//prompts
const COMMIT_SYSTEM_PROMPT =
  "Answer questions about git commits using ONLY the provided commit summaries. Mention commit hashes. If unknown, say: Not found in commit history."

const CODE_SYSTEM_PROMPT =
  "Summarize code behavior in 2–3 concise technical sentences."

const CODE_QA_SYSTEM_PROMPT =
  "Answer ONLY using the provided code context. " +
  "If one or more files match, list their file paths as bullet points. " +
  "Do NOT say 'not found' if any match exists. " +
  "Say 'Not found in the codebase' ONLY if there are zero matches."

//commit summary
export async function aiSummariseCommit(diff: string): Promise<string> {
  if (!diff || diff.length < 20) return "No significant changes."

  const truncatedDiff = truncate(diff, 3000)

  try {
    const resp = await retryWithBackoff(() =>
      groq.chat.completions.create({
        model: AI_MODELS.PRIMARY,
        messages: [
          { role: "system", content: "Summarize git diff. Max 3 bullets. WHAT changed only." },
          { role: "user", content: truncatedDiff },
        ],
        temperature: 0,
        max_tokens: 100,
      })
    )

    return resp.choices[0]?.message?.content?.trim() ?? "No significant changes."
  } catch {
    return "Summary unavailable due to rate limits."
  }
}

//code summary
export async function summariseCode(doc: Document): Promise<string> {
  const code = truncate(String(doc.pageContent ?? ""), 2500)
  if (code.length < 50) return "Minimal or non-functional code."

  try {
    const resp = await retryWithBackoff(() =>
      groq.chat.completions.create({
        model: AI_MODELS.PRIMARY,
        messages: [
          { role: "system", content: CODE_SYSTEM_PROMPT },
          { role: "user", content: code },
        ],
        temperature: 0.2,
        max_tokens: 120,
      })
    )

    return resp.choices[0]?.message?.content?.trim() ?? "Summary unavailable."
  } catch {
    return "Summary unavailable due to rate limits."
  }
}

//qa
export async function generateCodeQAResponse(
  context: string,
  question: string
): Promise<string> {
  if (!context || context.length < 50) {
    return "Not found in the codebase."
  }

  try {
    const resp = await retryWithBackoff(() =>
      groq.chat.completions.create({
        model: AI_MODELS.PRIMARY,
        messages: [
          { role: "system", content: CODE_QA_SYSTEM_PROMPT },
          {
            role: "user",
            content: `CODE:\n${truncate(context, 6000)}\n\nQUESTION:\n${truncate(question, 300)}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 400,
      })
    )

    return resp.choices[0]?.message?.content?.trim() ?? "Not found in the codebase."
  } catch {
    return "Not found in the codebase."
  }
}

//commit qa
export async function generateCommitQAResponse(
  context: string,
  question: string
): Promise<string> {
  try {
    const resp = await retryWithBackoff(() =>
      groq.chat.completions.create({
        model: AI_MODELS.PRIMARY,
        messages: [
          { role: "system", content: COMMIT_SYSTEM_PROMPT },
          {
            role: "user",
            content: `COMMITS:\n${truncate(context, 6000)}\n\nQUESTION:\n${truncate(question, 300)}`,
          },
        ],
        temperature: 0,
        max_tokens: 200,
      })
    )

    return resp.choices[0]?.message?.content?.trim() ?? "Not found in commit history."
  } catch {
    return "Not found in commit history."
  }
}


