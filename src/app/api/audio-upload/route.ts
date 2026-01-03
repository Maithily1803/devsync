// src/app/api/audio-upload/route.ts
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { startTranscription } from "@/lib/start-transcription";
import { consumeCredits } from "@/lib/credit-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    console.log("📤 Audio upload started");

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    console.log("📋 Form data:", {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      projectId,
    });

    if (!file || !projectId) {
      return NextResponse.json(
        { error: "Missing file or projectId" },
        { status: 400 }
      );
    }

    // ✅ Check credits BEFORE uploading
    try {
      await consumeCredits(
        userId,
        "MEETING_TRANSCRIBED",
        projectId,
        `Meeting: ${file.name}`
      );
      console.log("✅ Credits consumed successfully");
    } catch (error: any) {
      console.error("❌ Credit deduction failed:", error.message);
      return NextResponse.json(
        { 
          error: "Insufficient credits. Please purchase more credits to continue.",
          details: error.message 
        },
        { status: 402 }
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

    console.log("☁️ Uploading to Supabase...");

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `aud/${Date.now()}-${safeName}`;

    const upload = await supabaseServer.storage
      .from("aud")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (upload.error) {
      console.error("❌ Supabase upload error:", upload.error);
      return NextResponse.json(
        { error: upload.error.message },
        { status: 500 }
      );
    }

    console.log("✅ File uploaded to Supabase:", filePath);

    const { data: publicUrlData } = supabaseServer.storage
      .from("aud")
      .getPublicUrl(filePath);

    const audioUrl = publicUrlData.publicUrl;
    console.log("🔗 Audio URL:", audioUrl);

    console.log("💾 Creating meeting record...");

    const meeting = await db.meeting.create({
      data: {
        projectId,
        audioUrl,
        name: file.name,
        status: "processing",
      },
    });

    console.log("✅ Meeting created:", meeting.id);

    // 🚀 START TRANSCRIPTION
    await startTranscription(audioUrl, meeting.id);

    return NextResponse.json(
      {
        success: true,
        meeting: {
          id: meeting.id,
          name: meeting.name,
          audioUrl: meeting.audioUrl,
          status: meeting.status,
        },
        message: "Audio uploaded successfully. Transcription started.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Audio upload failed:", error);

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}