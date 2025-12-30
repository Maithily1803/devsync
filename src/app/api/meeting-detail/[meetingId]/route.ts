// src/app/api/meeting-detail/[meetingId]/route.ts
import { db } from "@/server/db";
import { NextResponse } from "next/server";
import { generateIssuesFromTranscript } from "@/lib/gemini-issues";

export async function GET(
  _req: Request,
  context: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await context.params;

    if (!meetingId) {
      return NextResponse.json(
        { error: "Meeting ID is required" },
        { status: 400 }
      );
    }

    const meeting = await db.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    // ✅ If still processing and has assemblyaiId, check status with AssemblyAI
    if (meeting.status === "processing" && meeting.assemblyaiId) {
      try {
        console.log("🔍 Checking AssemblyAI status for:", meeting.assemblyaiId);
        
        const asmRes = await fetch(
          `https://api.assemblyai.com/v2/transcript/${meeting.assemblyaiId}`,
          {
            headers: {
              Authorization: process.env.ASSEMBLYAI_API_KEY!,
            },
          }
        );

        if (asmRes.ok) {
          const asmData = await asmRes.json();

          console.log("📊 AssemblyAI status:", asmData.status);

          // If completed but DB not updated (webhook failed), update now
          if (asmData.status === "completed" && asmData.text) {
            console.log("✅ Transcript ready, generating issues...");
            
            // Generate issues if not already done
            const issues = await generateIssuesFromTranscript(
              asmData.text,
              meeting.name
            );

            console.log(`✅ Generated ${issues.length} issues`);

            // Update database
            await db.meeting.update({
              where: { id: meetingId },
              data: {
                transcript: asmData.text,
                status: "completed",
                issues: issues as any,
              },
            });

            // Return updated meeting
            return NextResponse.json({
              meeting: {
                ...meeting,
                transcript: asmData.text,
                status: "completed",
                issues: issues,
              },
            });
          }

          // If failed at AssemblyAI
          if (asmData.status === "error") {
            console.error("❌ AssemblyAI transcription failed");
            
            await db.meeting.update({
              where: { id: meetingId },
              data: { status: "failed" },
            });

            return NextResponse.json({
              meeting: {
                ...meeting,
                status: "failed",
              },
            });
          }
        }
      } catch (error) {
        console.error("❌ Error checking AssemblyAI status:", error);
        // Continue with current DB state
      }
    }

    // Return meeting as-is (might still be processing)
    return NextResponse.json({ meeting });
  } catch (error) {
    console.error("❌ Error fetching meeting detail:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}