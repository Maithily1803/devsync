// src/lib/issues.ts
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
});

export const IssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  category: z.enum(["bug", "feature", "task", "discussion"]),
  assignedTo: z.string().default(""),
  timestamp: z.string().default("N/A"),

});

export type Issue = z.infer<typeof IssueSchema>;

export async function generateIssuesFromTranscript(
  transcript: string,
  meetingName: string
): Promise<Issue[]> {
  try {
    console.log(`🤖 Generating issues for: ${meetingName}`);
    console.log(`📝 Transcript length: ${transcript.length} chars`);

    if (!transcript || transcript.length < 50) {
      console.log("⚠️ Transcript too short");
      return [];
    }

    const maxChars = 15000;
    const truncated =
      transcript.length > maxChars
        ? transcript.slice(0, maxChars) + "\n\n[...truncated]"
        : transcript;

    const resp = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a senior product manager extracting actionable issues from meeting transcripts.
Rules:
-Always extract issues if work, bugs, features, or decisions are discussed
- If any vague discussion into one concrete task
- Infer priority when not stated
- Use "N/A" if no timestamp is mentioned
- Use empty string if assignee is unknown
- Return [] ONLY if the transcript is completely irrelevant
Return ONLY valid JSON array, no markdown:
[
  {
    "id": "Issue-1",
    "title": "Short actionable title",
    "description": "Clear task or decision derived from the discussion",
    "timestamp": "HH:MM | N/A",
    "priority": "low | medium | high",
    "category": "bug | feature | task | discussion",
    "assignedTo": ""
  }
]

If no issues found, return []`,
        },
        {
          role: "user",
          content: `Meeting: ${meetingName}\n\nTranscript:\n${truncated}\n\nExtract issues:`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    let cleanText = resp.choices?.[0]?.message?.content?.trim() ?? "[]";

    // Remove markdown code blocks if present
    cleanText = cleanText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let parsed: unknown;

    try {
      parsed = JSON.parse(cleanText);
    } catch {
      console.error("❌ Failed to parse AI JSON output:", cleanText);
      return [];
    }

    if (!Array.isArray(parsed)) {
      console.error("❌ AI output is not an array:", parsed);
      return [];
    }

    // ✅ Validate issues individually instead of all-or-nothing
    const validIssues: Issue[] = [];

    for (const item of parsed) {
      const result = IssueSchema.safeParse(item);
      if (result.success) {
        validIssues.push(result.data);
      } else {
        console.warn("⚠️ Invalid issue skipped:", item);
      }
    }

    console.log(`✅ Generated ${validIssues.length} issues`);
    return validIssues;

  } catch (error: any) {
    console.error(
      "❌ Issue generation failed:",
      error?.response?.data || error?.message || error
    );
    return [];
  }
}
