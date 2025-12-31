'use server';
import { createStreamableValue } from "@ai-sdk/rsc";
import { openai, GEMINI_MODELS } from "@/lib/gemini";
import { generateEmbedding } from "@/lib/gemini";
import { db } from "@/server/db";


async function requestWithBackoff(
  fn: () => Promise<any>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<any> {
  let attempt = 0;
  
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      
      console.error(`Attempt ${attempt} failed:`, err.message);
      
      if (err.status !== 503 && err.status !== 429) {
        throw err;
      }
      
      if (attempt >= maxAttempts) {
        throw err;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  
  throw new Error("Max retries exceeded");
}

//q&a//

export async function askQuestion(question: string, projectId: string) {
  const stream = createStreamableValue<string>();

  
  let result: {
    fileName: string;
    sourceCode: string;
    summary: string;
    similarity: number;
  }[] = [];

  console.log("Question:", question);
  console.log("Project ID:", projectId);

  try {
    // generate embedding
    console.log("Generating question embedding...");
    const queryVector = await generateEmbedding(question);
    
    if (!queryVector || queryVector.length === 0) {
      throw new Error("Failed to generate question embedding");
    }

    const vectorQuery = `[${queryVector.join(",")}]`;
    console.log(`Embedding generated (${queryVector.length} dimensions)`);

    // fetch relevant files 
    console.log("🔍 Searching for relevant files...");
    
    result = await db.$queryRaw`
      SELECT "fileName", "sourceCode", "summary",
        1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) AS similarity
      FROM "SourceCodeEmbedding"
      WHERE 1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) > 0.5
        AND "projectId" = ${projectId}
      ORDER BY similarity DESC
      LIMIT 10
    ` as { fileName: string; sourceCode: string; summary: string; similarity: number }[];

    console.log(`Found ${result.length} relevant files`);
    
    if (result.length > 0) {
      console.log("Top matches:");
      result.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.fileName} (similarity: ${(r.similarity * 100).toFixed(1)}%)`);
      });
    }

    // context string
    let context = "";
    for (const doc of result) {
      // truncate long source code
      const truncatedCode = doc.sourceCode.length > 3000 
        ? doc.sourceCode.slice(0, 3000) + "\n\n[... truncated ...]"
        : doc.sourceCode;

      context += `
═══════════════════════════════════════
FILE: ${doc.fileName}
SUMMARY: ${doc.summary}
CODE:
${truncatedCode}
═══════════════════════════════════════

`;
    }

    console.log(`Context built: ${context.length} characters`);

    // stream AI response
    console.log("Streaming AI response...");

    (async () => {
      try {
        const messages = [
          {
            role: "system" as const,
            content: `You are an expert full-stack developer assistant helping users understand their codebase.

**Your Role:**
- Answer questions about code structure, functionality, and implementation
- Provide clear, accurate technical explanations
- Reference specific files and code sections when relevant
- Give actionable advice when asked for guidance

**Context Provided:**
You have access to relevant files from the user's codebase, including:
- File paths and names
- Code summaries
- Source code snippets

**Response Guidelines:**
1. **Be Specific**: Reference actual file names and code when answering
2. **Be Accurate**: Only use information from the provided context
3. **Be Concise**: Keep responses under 300 words unless more detail is needed
4. **Use Markdown**: Format code with \`backticks\` and use bullet points
5. **Admit Uncertainty**: If context doesn't contain the answer, say so clearly

**Example Response Format:**
Based on your codebase, here's what I found:

The [feature/component] is implemented in \`path/to/file.ts\`. Here's how it works:

• **Main functionality**: [explanation]
• **Key dependencies**: [list]
• **Integration points**: [where it connects]

To [achieve user's goal], you would need to modify \`specific-file.ts\` by [specific action].

**If Insufficient Context:**
"I don't see enough information in the provided context to fully answer that. However, based on what's available, [partial answer if possible]. Could you provide more specific details about [what's needed]?"`,
          },
          {
            role: "user" as const,
            content: `CODEBASE CONTEXT:
${context}

USER QUESTION:
${question}

Please answer the question based ONLY on the codebase context provided above. Be specific and reference actual files and code.`,
          },
        ];

        // stream the completion
        const completion = await requestWithBackoff(() => 
          openai.chat.completions.create({
            model: GEMINI_MODELS.PRIMARY,
            messages,
            stream: true,
            max_tokens: 1000,
            temperature: 0.3,
          })
        );

        let totalChunks = 0;
        for await (const chunk of completion) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            stream.update(delta);
            totalChunks++;
          }
        }

        console.log(`streaming complete (${totalChunks} chunks)`);
        stream.done();

      } catch (err: any) {
        console.error("streaming error:", err);
        
        // error message 
        stream.update(
          "\n\n **Error generating response.** " +
          "This might be due to rate limits or API issues. " +
          "Please try again in a moment."
        );
        stream.done();
      }
    })();

  } catch (err: any) {
    console.error("Question processing error:", err);
    
    stream.update(
      "\n\n **Error processing your question.** " +
      `Details: ${err.message}`
    );
    stream.done();
  }

  return {
    output: stream.value,
    filesReferences: result,
  };
}