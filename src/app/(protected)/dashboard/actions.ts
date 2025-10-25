'use server';

import { createStreamableValue } from "@ai-sdk/rsc";
import { openai } from "@/lib/gemini";
import { generateEmbedding } from "@/lib/gemini";
import { db } from "@/server/db";


export async function askQuestion(question: string, projectId: string) {
  const stream = createStreamableValue<string>();

  // 1️⃣ Generate embedding for the question
  const queryVector = await generateEmbedding(question);
  const vectorQuery = `[${queryVector.join(",")}]`;

  // 2️⃣ Fetch relevant files by vector similarity
  const result = await db.$queryRaw`
    SELECT "fileName", "sourceCode", "summary",
      1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) AS similarity
    FROM "SourceCodeEmbedding"
    WHERE 1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) > 0.5
      AND "projectId" = ${projectId}
    ORDER BY similarity DESC
    LIMIT 10
  ` as { fileName: string; sourceCode: string; summary: string }[];

  // 3️⃣ Build context string
  let context = "";
  for (const doc of result) {
    context += `source: ${doc.fileName}\ncode: ${doc.sourceCode}\nsummary: ${doc.summary}\n\n`;
  }

  // 4️⃣ Gemini response streaming with exponential backoff
async function requestWithExponentialBackoff(
  fn: () => Promise<any>, // <--- add this type annotation
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<any> { // <--- also annotate return type for clarity
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (err.status !== 503 || attempt >= maxAttempts) {
        throw err;
      }
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}


  (async () => {
    try {
      const messages = [
        {
          role: "system" as const,
          content: `
You are an expert full-stack developer with deep knowledge of Next.js, TypeScript, and modern software architecture.
You help users understand a GitHub repository by answering questions about code structure, components, APIs, routes, and logic.

Context provided will include code snippets, summaries, and file paths.
Use ONLY that context to answer — never hallucinate.

Guidelines:
1. If the question refers to a page, route, or component — identify the related file(s) and explain their purpose clearly.
2. If the question is about backend logic (APIs, database, authentication), describe which files implement it and how they interact.
3. If the question involves configuration (like .env, next.config.js, tailwind.config.js, etc.), explain their roles.
4. If multiple files are relevant, summarize each briefly and show how they connect.
5. If context is insufficient, reply: "I'm sorry, but I don't know the answer to that question."
6. Format answers in **Markdown** with bullet points, file paths, and code snippets if helpful.
7. Responses must be concise and under 300 words. 
          `,
        },
        {
          role: "user" as const,
          content: `CONTEXT:
${context}

QUESTION:
${question}

Instructions:
- Only use the context above.
- Be specific and technically accurate.
- Use Markdown and code snippets if helpful.`,
        },
      ];

      // 5️⃣ Stream the AI completion with retries
      const completion = await requestWithExponentialBackoff(() => 
        openai.chat.completions.create({
          model: "gemini-2.0-flash",
          messages,
          stream: true,
          max_tokens: 512,
        })
      );

      for await (const chunk of completion) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          stream.update(delta);
        }
      }

      stream.done();
    } catch (err) {
      console.error("⚠️ Gemini streaming error:", err);
      stream.done();
    }
  })();

  return {
    output: stream.value,
    filesReferences: result,
  };
}

