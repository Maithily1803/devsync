import OpenAI from "openai";
import type { Document } from "@langchain/core/documents";

export const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

/**
 * Models with free-tier quota
 */
export const GEMINI_MODELS = {
  PRIMARY: "gemini-2.5-flash",
  FALLBACK: "gemini-3-flash",
} as const;

/**
 * Explicit fallback order
 */
const MODEL_ORDER = [
  GEMINI_MODELS.PRIMARY,
  GEMINI_MODELS.FALLBACK,
] as const;

/* ---------------- helpers ---------------- */

function truncateToTokens(text: string, maxTokens: number) {
  const maxChars = maxTokens * 4;
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ---------------- COMMIT SUMMARY ---------------- */

export async function aiSummariseCommit(diff: string): Promise<string> {
  const truncatedDiff = truncateToTokens(diff, 8_000);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `
You are an expert programmer summarizing git diffs.

Rules:
- Output bullet points using "•"
- Be specific about WHAT changed
- Mention file paths when relevant
- No generic filler
- If nothing meaningful changed, return an empty response
      `.trim(),
    },
    {
      role: "user",
      content: `Summarize this git diff:\n\n${truncatedDiff}`,
    },
  ];

  let lastError: unknown;

  for (const model of MODEL_ORDER) {
    try {
      const resp = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 400,
      });

      const text = resp.choices?.[0]?.message?.content?.trim() ?? "";

      if (text.length >= 20) {
        return text;
      }
    } catch (err: any) {
      lastError = err;

      if (err?.status === 429) {
        await sleep(15_000);
        continue;
      }

      break;
    }
  }

  throw lastError ?? new Error("Gemini summary failed");
}

/* ---------------- CODE SUMMARY ---------------- */

export async function summariseCode(doc: Document): Promise<string> {
  try {
    const code = truncateToTokens(String(doc.pageContent), 6_000);

    const resp = await openai.chat.completions.create({
      model: GEMINI_MODELS.PRIMARY,
      messages: [
        {
          role: "system",
          content: "Summarize this source code in 2–3 technical sentences.",
        },
        {
          role: "user",
          content: code,
        },
      ],
      max_tokens: 200,
    });

    return resp.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  }
}

/* ---------------- EMBEDDINGS ---------------- */

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length < 10) return [];

  try {
    const resp = await openai.embeddings.create({
      model: "gemini-embedding-001",
      input: truncateToTokens(text, 6_000),
    });

    return resp.data?.[0]?.embedding ?? [];
  } catch {
    return [];
  }
}
