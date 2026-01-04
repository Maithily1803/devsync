// src/app/api/meeting-detail/[meetingId]/route.ts
import { db } from "@/server/db";
import { NextResponse } from "next/server";
import { generateIssuesFromTranscript } from "@/lib/issues";
import { consumeCredits } from "@/lib/credit-service";

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
      include: {
        project: {
          select: {
            UserToProjects: {
              select: { userId: true },
              take: 1
            }
          }
        }
      }
    });

    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    console.log("📋 Meeting detail request:", {
      id: meeting.id,
      status: meeting.status,
      hasAssemblyId: !!meeting.assemblyaiId,
      hasIssues: !!meeting.issues
    });

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

          // ✅ If completed but DB not updated (webhook failed/delayed), update now
          if (asmData.status === "completed" && asmData.text) {
            console.log("✅ Transcript ready, generating issues...");
            
            let issues: any[] = [];
            
            try {
              issues = await generateIssuesFromTranscript(
                asmData.text,
                meeting.name
              );
              console.log(`✅ Generated ${issues.length} issues`);
            } catch (err: any) {
              console.error("⚠️ Issue generation failed:", err.message);
            }

            // ✅ Deduct credits for issue generation
            if (issues.length > 0) {
              const userId = meeting.project.UserToProjects[0]?.userId;
              
              console.log("💳 Attempting to deduct credits...");
              console.log("   User ID:", userId);
              console.log("   Project ID:", meeting.projectId);
              console.log("   Issues count:", issues.length);
              
              if (userId) {
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
                  // Don't fail - issues were still generated
                }
              } else {
                console.error("❌ No user ID found for credit deduction");
              }
            }

            // ✅ Update database
            await db.meeting.update({
              where: { id: meetingId },
              data: {
                transcript: asmData.text,
                status: "completed",
                issues: issues as any,
              },
            });

            console.log("✅ Meeting updated via polling");

            // ✅ Return updated meeting (remove project relations)
            const { project, ...meetingData } = meeting;
            return NextResponse.json({
              meeting: {
                ...meetingData,
                transcript: asmData.text,
                status: "completed",
                issues: issues,
              },
            });
          }

          // ❌ If failed at AssemblyAI
          if (asmData.status === "error") {
            console.error("❌ AssemblyAI transcription failed");
            
            await db.meeting.update({
              where: { id: meetingId },
              data: { status: "failed" },
            });

            const { project, ...meetingData } = meeting;
            return NextResponse.json({
              meeting: {
                ...meetingData,
                status: "failed",
              },
            });
          }
        }
      } catch (error: any) {
        console.error("❌ Error checking AssemblyAI status:", error.message);
        // Continue with current DB state
      }
    }

    // ✅ Return meeting as-is (remove project relations for cleaner response)
    const { project, ...meetingData } = meeting;
    return NextResponse.json({ meeting: meetingData });
  } catch (error: any) {
    console.error("❌ Error fetching meeting detail:", error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}