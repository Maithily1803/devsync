import { NextResponse } from "next/server";
import axios from "axios";
import { db } from "@/server/db";
import { generateIssuesFromTranscript } from "@/lib/issues";
import { consumeCredits } from "@/lib/credit-service";

export async function POST(req: Request) {
  try {
    console.log("Webhook received");

    const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");

    if (auth !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      console.error("Webhook Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const { id, status, text } = payload;

    console.log("Webhook payload:", { id, status, textLength: text?.length });

    if (!id) {
      console.error("Missing transcript ID");
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const meeting = await db.meeting.findFirst({
      where: { assemblyaiId: id },
      select: { 
        id: true, 
        name: true, 
        projectId: true,
        status: true,
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
      console.error("Meeting not found for assemblyaiId:", id);
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    console.log("Meeting found:", meeting.id);

    const userId = meeting.project.UserToProjects[0]?.userId;
    console.log("User ID:", userId);

    if (!userId) {
      console.error("No user ID found for this project");
    }

    if (status === "completed") {
      if (meeting.status === "completed") {
        console.log("Meeting already processed, skipping");
        return NextResponse.json({ received: true, message: "Already processed" });
      }

      let finalText = text;

      if (!finalText) {
        console.log("Fetching transcript from AssemblyAI");
        const res = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${id}`,
          { headers: { authorization: process.env.ASSEMBLYAI_API_KEY! } }
        );
        finalText = res.data.text ?? "";
      }

      if (!finalText || finalText.length < 50) {
        console.error("No valid transcript text");
        await db.meeting.update({
          where: { id: meeting.id },
          data: { status: "failed" },
        });
        return NextResponse.json({ received: true });
      }

      console.log(`Transcript length: ${finalText.length}`);

      console.log("Generating issues");
      let issues: any[] = [];
      
      try {
        issues = await generateIssuesFromTranscript(finalText, meeting.name);
        console.log(`Generated ${issues.length} issues`);
      } catch (err: any) {
        console.error("Issue generation failed:", err.message);
      }

      if (issues.length > 0 && userId) {
        console.log("Attempting to deduct credits");
        
        try {
          const result = await consumeCredits(
            userId,
            "MEETING_ISSUES_GENERATED",
            meeting.projectId,
            `Generated ${issues.length} issues from: ${meeting.name.slice(0, 30)}...`
          );
          
          console.log("Credits deducted successfully");
          console.log(`Remaining credits: ${result.remaining}`);
        } catch (creditError: any) {
          console.error("Credit deduction FAILED:", creditError.message);
        }
      } else {
        if (issues.length === 0) {
          console.log("No issues generated, no credits deducted");
        }
        if (!userId) {
          console.log("No user ID, no credits deducted");
        }
      }

      console.log("Updating meeting in database");
      await db.meeting.update({
        where: { id: meeting.id },
        data: {
          transcript: finalText,
          status: "completed",
          issues: issues as any,
        },
      });

      console.log("Meeting saved successfully");
    }

    if (status === "error") {
      console.error("AssemblyAI transcription error:", payload);
      
      await db.meeting.update({
        where: { id: meeting.id },
        data: { status: "failed" },
      });
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error("Webhook error:", error.message);
    console.error("Stack:", error.stack);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
