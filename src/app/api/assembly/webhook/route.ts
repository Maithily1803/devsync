import { NextResponse } from "next/server";
import axios from "axios";
import { db } from "@/server/db";

export async function POST(req: Request) {
  // 🔐 Webhook Auth (case-safe)
  const auth =
    req.headers.get("authorization") ??
    req.headers.get("Authorization");

  if (auth !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    console.error("❌ Webhook Unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json();
  const { id, status, text } = payload;

  console.log("📩 AssemblyAI Webhook:", payload);

  if (!id) {
    console.error("❌ Missing AssemblyAI transcript ID");
    return NextResponse.json({ error: "Missing transcript ID" }, { status: 400 });
  }

  // ✅ Transcription completed
  if (status === "completed") {
    let finalText = text;

    // If webhook didn't include text, fetch it manually
    if (!finalText) {
      const res = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${id}`,
        {
          headers: {
            authorization: process.env.ASSEMBLYAI_API_KEY!,
          },
        }
      );

      finalText = res.data.text ?? "";
    }

    await db.meeting.update({
      where: { assemblyaiId: id },
      data: {
        transcript: finalText,
        status: "completed",
      },
    });

    console.log("✅ Meeting transcript saved");
  }

  // ❌ Transcription failed
  if (status === "error") {
    await db.meeting.update({
      where: { assemblyaiId: id },
      data: {
        status: "failed",
      },
    });

    console.error("❌ AssemblyAI transcription failed:", payload);
  }

  return NextResponse.json({ received: true });
}
