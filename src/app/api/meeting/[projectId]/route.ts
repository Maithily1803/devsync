import { db } from "@/server/db";
import { NextResponse } from "next/server";

/**
 * GET /api/meeting/:projectId
 * → Fetch all meetings for a project
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  if (!projectId) {
    return NextResponse.json(
      { error: "Project ID is required" },
      { status: 400 }
    );
  }

  const meetings = await db.meeting.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ meetings });
}

/**
 * DELETE /api/meeting/:meetingId
 * → Delete a single meeting
 *
 * ⚠️ NOTE:
 * The param name is `projectId` because of folder name,
 * but here it represents `meetingId`.
 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const meetingId = projectId; // 👈 interpret as meetingId

    if (!meetingId) {
      return NextResponse.json(
        { error: "Meeting ID is required" },
        { status: 400 }
      );
    }

    // Check meeting exists
    const meeting = await db.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    // Delete meeting
    await db.meeting.delete({
      where: { id: meetingId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Failed to delete meeting:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
