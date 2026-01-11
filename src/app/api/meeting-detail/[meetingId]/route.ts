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

    console.log("Meeting detail request:", {
      id: meeting.id,
      status: meeting.status,
      hasAssemblyId: !!meeting.assemblyaiId,
      hasIssues: !!meeting.issues
    });

    if (meeting.status === "processing" && meeting.assemblyaiId) {
      try {
        console.log("Checking AssemblyAI status for:", meeting.assemblyaiId);
        
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
          console.log("AssemblyAI status:", asmData.status);

          if (asmData.status === "completed" && asmData.text) {
            console.log("Transcript ready, generating issues");
            
            let issues: any[] = [];
            
            try {
              issues = await generateIssuesFromTranscript(
                asmData.text,
                meeting.name
              );
              console.log(`Generated ${issues.length} issues`);
            } catch (err: any) {
              console.error("Issue generation failed:", err.message);
            }

            const currentMeeting = await db.meeting.findUnique({
              where: { id: meetingId },
              select: { status: true }
            });

            if (currentMeeting?.status === "processing" && issues.length > 0) {
              const userId = meeting.project.UserToProjects[0]?.userId;
              
              if (userId) {
                console.log("Attempting to deduct credits (polling)");
                
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
              }
            } else {
              console.log("Meeting already processed or no issues, skipping credit deduction");
            }

            await db.meeting.update({
              where: { id: meetingId },
              data: {
                transcript: asmData.text,
                status: "completed",
                issues: issues as any,
              },
            });

            console.log("Meeting updated via polling");

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

          if (asmData.status === "error") {
            console.error("AssemblyAI transcription failed");
            
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
        console.error("Error checking AssemblyAI status:", error.message);
      }
    }

    const { project, ...meetingData } = meeting;
    return NextResponse.json({ meeting: meetingData });
  } catch (error: any) {
    console.error("Error fetching meeting detail:", error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
