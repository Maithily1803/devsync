import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/server/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";


export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400 }
      );
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Upload to Supabase
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `aud/${Date.now()}-${file.name}`;

    const upload = await supabaseServer.storage
      .from("aud")
      .upload(fileName, buffer, {
        contentType: file.type,
      });

    if (upload.error) {
      console.error("❌ Supabase upload error:", upload.error);
      return NextResponse.json(
        { error: upload.error.message },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabaseServer.storage
      .from("aud")
      .getPublicUrl(fileName);

    const audioUrl = publicUrlData.publicUrl;

    // Create meeting
    const meeting = await db.meeting.create({
      data: {
        projectId,
        audioUrl,
        name: file.name,
        status: "processing",
      },
    });

    return NextResponse.json(
      {
        success: true,
        audioUrl,
        meetingId: meeting.id,
        projectId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ /api/audio-upload failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

