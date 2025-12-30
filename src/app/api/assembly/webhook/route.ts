// src/app/api/assembly/webhook/route.ts
import { NextResponse } from "next/server";
import axios from "axios";
import { db } from "@/server/db";
import { generateIssuesFromTranscript } from "@/lib/gemini-issues";

export async function POST(req: Request) {
  try {
    // 🔐 Webhook Auth (case-safe)
    const auth =
      req.headers.get("authorization") ??
      req.headers.get("Authorization");

    if (auth !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      console.error("❌ Webhook Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const { id, status, text } = payload;

    console.log("📩 AssemblyAI Webhook received:", { id, status });

    if (!id) {
      console.error("❌ Missing AssemblyAI transcript ID");
      return NextResponse.json(
        { error: "Missing transcript ID" },
        { status: 400 }
      );
    }

    // ✅ Transcription completed
    if (status === "completed") {
      let finalText = text;

      // If webhook didn't include text, fetch it manually
      if (!finalText) {
        console.log("📥 Fetching transcript from AssemblyAI...");
        const res = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${id}`,
          {
            headers: {
              authorization: process.env.ASSEMBLYAI_API_KEY!,
            },
          }
        );

        finalText = res.data.text ?? "";
      }

      if (!finalText) {
        console.error("❌ No transcript text available");
        await db.meeting.update({
          where: { assemblyaiId: id },
          data: { status: "failed" },
        });
        return NextResponse.json({ received: true });
      }

      // Get meeting to access name
      const meeting = await db.meeting.findUnique({
        where: { assemblyaiId: id },
        select: { name: true, id: true },
      });

      if (!meeting) {
        console.error("❌ Meeting not found for assemblyaiId:", id);
        return NextResponse.json(
          { error: "Meeting not found" },
          { status: 404 }
        );
      }

      console.log(`✅ Transcript received for: ${meeting.name}`);
      console.log(`📝 Transcript length: ${finalText.length} characters`);

      // Generate issues from transcript
      console.log("🤖 Generating issues with Gemini AI...");
      const issues = await generateIssuesFromTranscript(
        finalText,
        meeting.name
      );
      console.log(`✅ Generated ${issues.length} issues`);

      // Update meeting with transcript and issues
      await db.meeting.update({
        where: { assemblyaiId: id },
        data: {
          transcript: finalText,
          status: "completed",
          issues: issues as any, // JSON field
        },
      });

      console.log("✅ Meeting transcript and issues saved successfully");
    }

    // ❌ Transcription failed
    if (status === "error") {
      await db.meeting.update({
        where: { assemblyaiId: id },
        data: {
          status: "failed",
        },
      });

      console.error("❌ AssemblyAI transcription failed:", payload);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ Webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}