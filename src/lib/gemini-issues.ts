// src/lib/gemini-issues.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const IssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  timestamp: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  category: z.enum(["bug", "feature", "task", "discussion"]),
  assignedTo: z.string().optional(),
});

export type Issue = z.infer<typeof IssueSchema>;

export async function generateIssuesFromTranscript(
  transcript: string,
  meetingName: string
): Promise<Issue[]> {
  try {
    console.log(`🤖 Generating issues for meeting: ${meetingName}`);
    console.log(`📝 Transcript length: ${transcript.length} characters`);

    if (!transcript || transcript.length < 50) {
      console.log("⚠️ Transcript too short, skipping issue generation");
      return [];
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are an expert project manager analyzing a meeting transcript. Extract actionable issues, bugs, features, and tasks from the following meeting transcript.

Meeting: ${meetingName}
Transcript:
${transcript}

Generate a JSON array of issues with the following structure:
[
  {
    "id": "unique-id",
    "title": "Brief title (max 80 chars)",
    "description": "Detailed description with context",
    "timestamp": "HH:MM:SS or time range when discussed",
    "priority": "low" | "medium" | "high",
    "category": "bug" | "feature" | "task" | "discussion",
    "assignedTo": "person mentioned or empty string"
  }
]

Guidelines:
- Only extract genuine action items, bugs, or features discussed
- Infer priority from urgency words (ASAP, critical, when time permits, etc.)
- Use "discussion" category for topics that need follow-up but aren't actionable yet
- Set timestamp to approximate time in transcript (e.g., "00:05-00:12")
- If no clear assignee mentioned, leave "assignedTo" as empty string
- Return empty array [] if no issues found
- Return ONLY valid JSON, no markdown formatting

Return the JSON array:`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    console.log("📥 Received response from Gemini");

    // Clean response
    let cleanedResponse = response.trim();
    cleanedResponse = cleanedResponse.replace(/```json\n?/g, "");
    cleanedResponse = cleanedResponse.replace(/```\n?/g, "");
    cleanedResponse = cleanedResponse.trim();

    console.log("🧹 Cleaned response, attempting to parse JSON");

    const issues = JSON.parse(cleanedResponse);

    // Validate with Zod
    const validatedIssues = z.array(IssueSchema).parse(issues);

    console.log(`✅ Successfully generated ${validatedIssues.length} issues`);

    return validatedIssues;
  } catch (error) {
    console.error("❌ Gemini issue generation failed:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
    return [];
  }
}