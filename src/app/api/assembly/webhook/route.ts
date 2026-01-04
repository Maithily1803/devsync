// src/app/api/assembly/webhook/route.ts
import { NextResponse } from "next/server";
import axios from "axios";
import { db } from "@/server/db";
import { generateIssuesFromTranscript } from "@/lib/issues";
import { consumeCredits } from "@/lib/credit-service";

export async function POST(req: Request) {
  try {
    console.log("📩 Webhook received");

    // 🔐 Verify webhook auth
    const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");

    if (auth !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      console.error("❌ Webhook Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const { id, status, text } = payload;

    console.log("📊 Webhook payload:", { id, status, textLength: text?.length });

    if (!id) {
      console.error("❌ Missing transcript ID");
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    // Find meeting with user info
    const meeting = await db.meeting.findFirst({
      where: { assemblyaiId: id },
      select: { 
        id: true, 
        name: true, 
        projectId: true,
        project: {
          select: {
            UserToProjects: {
              select: { userId: true },
              take: 1
            }
          }
        }
      },
    });

    if (!meeting) {
      console.error("❌ Meeting not found for assemblyaiId:", id);
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    console.log("✅ Meeting found:", meeting.id);
    console.log("📦 Project ID:", meeting.projectId);

    // Get user ID
    const userId = meeting.project.UserToProjects[0]?.userId;
    console.log("👤 User ID:", userId);

    if (!userId) {
      console.error("❌ No user ID found for this project!");
      // Still process meeting but don't deduct credits
    }

    // ✅ Transcription completed
    if (status === "completed") {
      let finalText = text;

      // If no text in webhook, fetch manually
      if (!finalText) {
        console.log("📥 Fetching transcript from AssemblyAI...");
        const res = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${id}`,
          { headers: { authorization: process.env.ASSEMBLYAI_API_KEY! } }
        );
        finalText = res.data.text ?? "";
      }

      if (!finalText || finalText.length < 50) {
        console.error("❌ No valid transcript text");
        await db.meeting.update({
          where: { id: meeting.id },
          data: { status: "failed" },
        });
        return NextResponse.json({ received: true });
      }

      console.log(`✅ Transcript: ${finalText.length} chars`);

      // 🤖 Generate issues
      console.log("🤖 Generating issues...");
      let issues: any[] = [];
      
      try {
        issues = await generateIssuesFromTranscript(finalText, meeting.name);
        console.log(`✅ Generated ${issues.length} issues`);
      } catch (err: any) {
        console.error("❌ Issue generation failed:", err.message);
        // Continue anyway, save transcript without issues
      }

      // ✅ Deduct credits for issue generation
      if (issues.length > 0 && userId) {
        console.log("💳 Attempting to deduct credits...");
        console.log("   User ID:", userId);
        console.log("   Project ID:", meeting.projectId);
        console.log("   Issues count:", issues.length);
        
        try {
          const result = await consumeCredits(
            userId,
            "MEETING_ISSUES_GENERATED",
            meeting.projectId,
            `Generated ${issues.length} issues from: ${meeting.name.slice(0, 30)}...`
          );
          
          console.log("✅ Credits deducted successfully!");
          console.log("   Remaining credits:", result.remaining);
        } catch (creditError: any) {
          console.error("❌ Credit deduction FAILED:", creditError.message);
          console.error("   Error name:", creditError.name);
          console.error("   Full error:", creditError);
          
          // Don't fail the webhook - issues were still generated
          // But log clearly that credits weren't deducted
        }
      } else {
        if (issues.length === 0) {
          console.log("⚠️ No issues generated, no credits deducted");
        }
        if (!userId) {
          console.log("⚠️ No user ID, no credits deducted");
        }
      }

      // ✅ Update meeting with transcript and issues
      console.log("💾 Updating meeting in database...");
      await db.meeting.update({
        where: { id: meeting.id },
        data: {
          transcript: finalText,
          status: "completed",
          issues: issues as any,
        },
      });

      console.log("✅ Meeting saved successfully");
      console.log("✅ Webhook processed successfully");
    }

    // ❌ Transcription failed
    if (status === "error") {
      console.error("❌ AssemblyAI transcription error:", payload);
      
      await db.meeting.update({
        where: { id: meeting.id },
        data: { status: "failed" },
      });
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error("❌ Webhook error:", error.message);
    console.error("❌ Full error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}