// src/lib/ai-service.ts
import OpenAI from "openai";
import type { Document } from "@langchain/core/documents";

export const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": "Devsync",
  },
});


export const AI_MODELS = {
  PRIMARY: "openai/gpt-4o-mini",            
  FALLBACK: "openai/gpt-4o-mini-2024-07-18", // Backup
  EMBEDDINGS: "openai/text-embedding-3-small",     
} as const;

const MODEL_ORDER = [AI_MODELS.PRIMARY, AI_MODELS.FALLBACK] as const;

//helper

function truncateToTokens(text: string, maxTokens: number) {
  const maxChars = maxTokens * 4;
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

//commit summary 

export async function aiSummariseCommit(diff: string): Promise<string> {
  const truncatedDiff = truncateToTokens(diff, 8_000);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `
You are an expert programmer summarizing git diffs.

Rules:
- Output AT MOST 5 bullet points bullet points using "*"
- Focus only on WHAT changed (not why)
- Mention file paths when relevant
- No explanations, no generic filler text
- No introductions or conclusions
- If changes are trivial, summarize in 1 bullet only
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
        temperature: 0.1,
        max_tokens: 180,
      });

      const text = resp.choices?.[0]?.message?.content?.trim() ?? "";

      
      if (text.length > 0) {
        return text;
      }
    } catch (err: any) {
      lastError = err;

      
      console.error(
        "Commit summary AI error:",
        err?.response?.data || err?.message || err
      );

      if (err?.status === 429) {
        console.log("Rate limited, waiting 15s...");
        await sleep(15_000);
        continue;
      }

      break;
    }
  }

  throw lastError ?? new Error("AI summary failed");
}

//code summary 

export async function summariseCode(doc: Document): Promise<string> {
  try {
    const code = truncateToTokens(String(doc.pageContent), 6_000);

    const resp = await openai.chat.completions.create({
      model: AI_MODELS.PRIMARY,
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
  } catch (err: any) {
    console.error(
      `Code summary failed for ${doc.metadata.source}:`,
      err?.response?.data || err?.message || err
    );
    return "";
  }
}


export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length < 10) return [];

  try {
    const resp = await openai.embeddings.create({
      model: AI_MODELS.EMBEDDINGS,
      input: truncateToTokens(text, 6_000),
    });

    const embedding = resp.data?.[0]?.embedding ?? [];

   
    if (embedding.length > 0 && embedding.length !== 1536) {
      console.warn(
        `Unexpected embedding size: ${embedding.length} (expected 1536)`
      );
    }

    return embedding;
  } catch (err: any) {
    console.error(
      " Embedding generation failed:",
      err?.response?.data || err?.message || err
    );
    return [];
  }
}
