import { NextResponse } from "next/server";
import { db } from "@/server/db";

export async function POST(req: Request) {
  const { audioUrl, meetingId } = await req.json();

  // 🛑 Validate input
  if (!audioUrl || !meetingId) {
    console.error("❌ Missing audioUrl or meetingId", { audioUrl, meetingId });
    return NextResponse.json(
      { error: "audioUrl and meetingId are required" },
      { status: 400 }
    );
  }

  // 🎙 Create AssemblyAI transcript
  const res = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      Authorization: process.env.ASSEMBLYAI_API_KEY!, // ⚠️ MUST be capital A
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,

      // ✅ Webhook
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/assembly/webhook`,

      // ✅ ONLY supported auth fields
      webhook_auth_header_name: "authorization",
      webhook_auth_header_value: `Bearer ${process.env.WEBHOOK_SECRET}`,
    }),
  });

  const data = await res.json();

  // 🚨 Hard failure logging
  if (!res.ok) {
    console.error("❌ AssemblyAI rejected request:", data);
    return NextResponse.json(
      { error: "AssemblyAI rejected request", details: data },
      { status: 500 }
    );
  }

  if (!data.id) {
    console.error("❌ AssemblyAI response missing transcript ID:", data);
    return NextResponse.json(
      { error: "AssemblyAI response missing transcript ID" },
      { status: 500 }
    );
  }

  // ✅ Save transcript job ID
  await db.meeting.update({
    where: { id: meetingId },
    data: { assemblyaiId: data.id },
  });

  return NextResponse.json({ transcriptId: data.id });
}
