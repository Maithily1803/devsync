import OpenAI from "openai";
import type { Document } from "@langchain/core/documents";

export const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

/**
 * Summarize a Git diff using Gemini 2.0 Flash (OpenAI-compatible endpoint)
 */
export const aiSummariseCommit = async (diff: string): Promise<string> => {
  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are an expert programmer, and you are trying to summarize a git diff.
Reminders about the git diff format:
- Lines starting with "+" were added
- Lines starting with "-" were deleted
- Lines starting with neither are context

EXAMPLE SUMMARY COMMENTS:
* Raised the amount of returned recordings from \`10\` to \`100\` [packages/server/recordings_api.ts], [packages/server/constants.ts]
* Fixed a typo in the github action name [.github/workflows/gpt-commit-summarizer.yml]
* Moved the \`octokit\` initialization to a separate file [src/octokit.ts], [src/index.ts]
* Added an OpenAI API for completions [packages/utils/apis/openai.ts]
* Lowered numeric tolerance for test files

Most commits will have fewer comments than this example list.
The last comment does not include file names if there are more than two relevant files.
Do not include parts of the example in your summary; it is only for reference.`,
      },
      {
        role: "user",
        content: `Please summarise the following diff file:\n\n${diff}`,
      },
    ];

    const resp = await openai.chat.completions.create({
      model: "gemini-2.0-flash",
      messages,
    });

    const text = resp.choices?.[0]?.message?.content ?? "";
    return text.trim();
  } catch (error) {
    console.error("Error summarising commit:", error);
    return "";
  }
};

/**
 * Summarize a source code file (used for embedding or quick summaries)
 */
export async function summariseCode(doc: Document): Promise<string> {
  console.log("Getting summary for", doc.metadata.source);
  try {
    const code = String(doc.pageContent).slice(0, 10000);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          `You are summarizing source code for semantic search and developer Q&A.
Include the file’s role (e.g., frontend page, component, API route, config, util), its location, and what it exports or renders.
If it defines a page (like /src/app/page.tsx), mention it clearly as the homepage or route handler.`,
      },
      {
        role: "user",
        content: `You are onboarding a junior engineer and explaining the purpose of the file: ${doc.metadata.source}.
Here is the source code:
---
${code}
---
Give a summary no more than 100 words of the code above.`,
      },
    ];

    const resp = await openai.chat.completions.create({
      model: "gemini-2.0-flash",
      messages,
    });

    const text = resp.choices?.[0]?.message?.content ?? "";
    return text.trim();
  } catch (error) {
    console.error("Error summarising code:", error);
    return "";
  }
}

/**
 * Generate an embedding vector from text using Gemini Embedding Model
 */
export async function generateEmbedding(summary: string): Promise<number[]> {
  if (!summary || summary.trim().length < 10) {
    console.warn("⚠️ Skipping embedding — summary too short or empty");
    return [];
  }
  try {
    const resp = await openai.embeddings.create({
      model: "gemini-embedding-001",
      input: summary,
    });

    const embedding = resp.data?.[0]?.embedding;
    if (!embedding) {
      console.warn("⚠️ No embeddings returned from Gemini for summary:", summary);
      return [];
    }

    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return [];
  }
}
