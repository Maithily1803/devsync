// src/lib/start-transcription.ts
import { db } from "@/server/db";

export async function startTranscription(
  audioUrl: string,
  meetingId: string
) {
  console.log("🚀 Creating AssemblyAI transcript...");

  const assemblyRes = await fetch(
    "https://api.assemblyai.com/v2/transcript",
    {
      method: "POST",
      headers: {
        Authorization: process.env.ASSEMBLYAI_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: audioUrl,
      }),
    }
  );

  if (!assemblyRes.ok) {
    const errorText = await assemblyRes.text();
    console.error("❌ AssemblyAI rejected request:", errorText);

    await db.meeting.update({
      where: { id: meetingId },
      data: { status: "failed" },
    });

    throw new Error("AssemblyAI rejected transcription request");
  }

  const assemblyData = await assemblyRes.json();

  if (!assemblyData.id) {
    console.error("❌ No transcript ID returned:", assemblyData);
    throw new Error("AssemblyAI did not return transcript ID");
  }

  console.log("💾 Saving AssemblyAI transcript ID:", assemblyData.id);

  await db.meeting.update({
    where: { id: meetingId },
    data: {
      assemblyaiId: assemblyData.id,
      status: "processing",
    },
  });

  return assemblyData;
}
