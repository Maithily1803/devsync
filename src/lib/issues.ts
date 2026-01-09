import Groq from "groq-sdk";
import { z } from "zod";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
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

const ISSUE_SYSTEM_PROMPT =
  `
You are extracting ACTIONABLE issues from a meeting transcript.

RULES:
- Extract AT MOST 3 issues
- Prefer HIGH priority over medium, medium over low
- Merge similar or repeated discussions into ONE issue
- Ignore vague chatter and opinions
- Return ONLY valid JSON (no markdown, no explanations)

If fewer than 3 real issues exist, return fewer.
If nothing actionable exists, return [].
`.trim();

function truncateTranscript(text: string, maxChars = 12_000) {
  return text.length > maxChars
    ? text.slice(0, maxChars) + "\n\n[...truncated]"
    : text;
}

const PRIORITY_ORDER: Record<Issue["priority"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export async function generateIssuesFromTranscript(
  transcript: string,
  meetingName: string
): Promise<Issue[]> {
  try {
    if (!transcript || transcript.length < 50) return [];

    const truncated = truncateTranscript(transcript);

    const resp = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: ISSUE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `
Meeting: ${meetingName}

Transcript:
${truncated}

Return JSON in this format ONLY:
[
  {
    "id": "Issue-1",
    "title": "Short actionable title",
    "description": "Clear task or decision",
    "timestamp": "HH:MM | N/A",
    "priority": "low | medium | high",
    "category": "bug | feature | task | discussion",
    "assignedTo": ""
  }
]
          `.trim(),
        },
      ],
      temperature: 0.2,
      max_tokens: 700,
    });

    let raw = resp.choices?.[0]?.message?.content ?? "[]";

    raw = raw
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("Invalid JSON from model:", raw);
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    const validated: Issue[] = [];

    for (const item of parsed) {
      const res = IssueSchema.safeParse(item);
      if (res.success) {
        validated.push(res.data);
      }
    }

    return validated
      .sort(
        (a, b) =>
          PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]
      )
      .slice(0, 3);

  } catch (err: any) {
    console.error(
      " Issue extraction failed:",
      err?.response?.data || err?.message || err
    );
    return [];
  }
}
