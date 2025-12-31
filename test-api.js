// test-api.js
// Run with: node test-api.js

const API_KEY = process.env.GEMINI_API_KEY || "YOUR_API_KEY_HERE";

async function testGemini() {
  console.log("Testing Gemini API...\n");

  // 1️⃣ Test API key
  console.log("1) Testing API key with models endpoint...");
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?key=" + API_KEY
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Key test failed:", errorText);
      return;
    }

    const data = await response.json();
    console.log("API Key is valid");
    console.log(`Found ${data.models?.length || 0} models\n`);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Network error:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
    return;
  }

  // 2️⃣ Test text generation
  console.log("2) Testing text generation...");
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: "Say 'Hello' if you can read this." }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorJson = await response.json();
      console.error("Text generation failed:", errorJson);
      return;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("Text generation works");
    console.log("Response:", text?.slice(0, 100), "\n");
  } catch (error) {
    if (error instanceof Error) {
      console.error("Text generation error:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
    return;
  }

  // 3️⃣ Test embeddings
  console.log("3) Testing embeddings...");
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=" + API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: {
            parts: [{ text: "This is a test for embeddings." }],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorJson = await response.json();
      console.error("Embedding failed:", errorJson);
      return;
    }

    const data = await response.json();
    const embedding = data.embedding?.values;
    console.log("Embeddings work");
    console.log(`Generated ${embedding?.length || 0} dimensions\n`);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Embedding error:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
    return;
  }

  console.log("All Gemini API tests passed");
}

testGemini();
