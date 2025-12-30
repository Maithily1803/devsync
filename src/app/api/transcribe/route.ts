// src/app/api/transcribe/route.ts
import { NextResponse } from "next/server";
import { db } from "@/server/db";

export async function POST(req: Request) {
  try {
    const { audioUrl, meetingId } = await req.json();

    console.log("🎤 Transcription request:", { audioUrl, meetingId });

    // Validate input
    if (!audioUrl || !meetingId) {
      console.error("❌ Missing required fields:", { audioUrl, meetingId });
      return NextResponse.json(
        { error: "audioUrl and meetingId are required" },
        { status: 400 }
      );
    }

    // Verify meeting exists
    const meeting = await db.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      console.error("❌ Meeting not found:", meetingId);
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    console.log("✅ Meeting verified:", meeting.name);

    // Create AssemblyAI transcript
    console.log("🚀 Creating AssemblyAI transcript...");
    
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/assembly/webhook`;
    console.log("🔗 Webhook URL:", webhookUrl);

    const assemblyRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        Authorization: process.env.ASSEMBLYAI_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        webhook_url: webhookUrl,
        webhook_auth_header_name: "authorization",
        webhook_auth_header_value: `Bearer ${process.env.WEBHOOK_SECRET}`,
      }),
    });

    if (!assemblyRes.ok) {
  const errorText = await assemblyRes.text();
  console.error("❌ AssemblyAI error:", errorText);

  await db.meeting.update({
    where: { id: meetingId },
    data: { status: "failed" },
  });

  return NextResponse.json(
    { error: "AssemblyAI rejected request", details: errorText },
    { status: 500 }
  );
}
    const assemblyData = await assemblyRes.json();

    console.log("📊 AssemblyAI response:", {
      ok: assemblyRes.ok,
      status: assemblyRes.status,
      id: assemblyData.id,
    });

    // Handle errors
    if (!assemblyRes.ok) {
      console.error("❌ AssemblyAI rejected request:", assemblyData);
      
      await db.meeting.update({
        where: { id: meetingId },
        data: { status: "failed" },
      });

      return NextResponse.json(
        { 
          error: "AssemblyAI rejected request", 
          details: assemblyData 
        },
        { status: 500 }
      );
    }

    if (!assemblyData.id) {
      console.error("❌ No transcript ID in response:", assemblyData);
      
      await db.meeting.update({
        where: { id: meetingId },
        data: { status: "failed" },
      });

      return NextResponse.json(
        { error: "AssemblyAI response missing transcript ID" },
        { status: 500 }
      );
    }

    // Save transcript job ID
    console.log("💾 Saving transcript ID to database...");
    await db.meeting.update({
      where: { id: meetingId },
      data: { 
        assemblyaiId: assemblyData.id,
        status: "processing"
      },
    });

    console.log("✅ Transcription started successfully:", assemblyData.id);

    return NextResponse.json({ 
      transcriptId: assemblyData.id,
      status: assemblyData.status,
      message: "Transcription started successfully"
    });
  } catch (error) {
    console.error("❌ Transcribe API error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}