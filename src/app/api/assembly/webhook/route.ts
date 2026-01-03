// src/app/api/assembly/webhook/route.ts
import { NextResponse } from "next/server";
import axios from "axios";
import { db } from "@/server/db";
import { generateIssuesFromTranscript } from "@/lib/gemini-issues";

export async function POST(req: Request) {
  try {
    // 🔐 Verify webhook auth
    const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");

    if (auth !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      console.error("❌ Webhook Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const { id, status, text } = payload;

    console.log("📩 AssemblyAI Webhook:", { id, status });

    if (!id) {
      console.error("❌ Missing transcript ID");
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    // ✅ Transcription completed
    if (status === "completed") {
      let finalText = text;

      // If no text in webhook, fetch manually
      if (!finalText) {
        console.log("📥 Fetching transcript...");
        const res = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${id}`,
          { headers: { authorization: process.env.ASSEMBLYAI_API_KEY! } }
        );
        finalText = res.data.text ?? "";
      }

      if (!finalText) {
        console.error("❌ No transcript text");
        await db.meeting.updateMany({
          where: { assemblyaiId: id },
          data: { status: "failed" },
        });
        return NextResponse.json({ received: true });
      }

      // Get meeting
      const meeting = await db.meeting.findFirst({
        where: { assemblyaiId: id },
        select: { id: true, name: true },
      });

      if (!meeting) {
        console.error("❌ Meeting not found:", id);
        return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
      }

      console.log(`✅ Transcript: ${finalText.length} chars`);

      // 🤖 Generate issues
      console.log("🤖 Generating issues...");
      let issues: any[] = [];
      
      try {
        issues = await generateIssuesFromTranscript(finalText, meeting.name);
        console.log(`✅ Generated ${issues.length} issues`);
      } catch (err: any) {
        console.error("⚠️ Issue generation failed:", err.message);
        // Continue anyway, save transcript
      }

      // ✅ Update meeting
      await db.meeting.update({
        where: { id: meeting.id },
        data: {
          transcript: finalText,
          status: "completed",
          issues: issues as any,
        },
      });

      console.log("✅ Meeting saved successfully");
    }

    // ❌ Transcription failed
    if (status === "error") {
      console.error("❌ AssemblyAI error:", payload);
      
      await db.meeting.updateMany({
        where: { assemblyaiId: id },
        data: { status: "failed" },
      });
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error("❌ Webhook error:", error.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}