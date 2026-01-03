import "dotenv/config";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
});

async function test() {
  try {
    const resp = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "Say hello!" }],
    });

    const message = resp.choices?.[0]?.message?.content ?? "No response";
    console.log("✅ OpenRouter working:", message);

  } catch (err) {
    console.error("❌ OpenRouter failed:", err);
  }
}

test();
