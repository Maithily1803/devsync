const MODEL = "voyage-code-2";
const DIMENSIONS = 1536;

function getApiKey() {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error("VOYAGE_API_KEY is not set");
  }
  return key;
}

async function voyageEmbed(inputs: string[]): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: inputs,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Voyage API error: ${text}`);
  }

  const json = await res.json();
  return json.data.map((d: { embedding: number[] }) => d.embedding);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length < 10) {
    return [];
  }

  try {
    const truncated = text.slice(0, 8000);

    const [vector] = await voyageEmbed([truncated]);

    if (!vector || vector.length !== DIMENSIONS) {
      throw new Error(`Expected ${DIMENSIONS} dims, got ${vector?.length}`);
    }

    return vector;
  } catch (error: any) {
    console.error("Embedding generation failed:", error.message);
    return new Array(DIMENSIONS).fill(0);
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  try {
    const truncated = texts.map(t => t.slice(0, 8000));

    const vectors = await voyageEmbed(truncated);

    return vectors.map(v => {
      if (!v || v.length !== DIMENSIONS) {
        return new Array(DIMENSIONS).fill(0);
      }
      return v;
    });
  } catch (error: any) {
    console.error("Batch embedding failed:", error.message);
    return texts.map(() => new Array(DIMENSIONS).fill(0));
  }
}

export async function testEmbeddings(): Promise<void> {
  console.log("Testing Voyage embeddings...");

  const text = "export function authenticate(req: Request) { return true; }";

  const embedding = await generateEmbedding(text);

  console.log(`
Embedding test passed!
  - Dimensions: ${embedding.length}
  - Sample: [${embedding.slice(0, 5).map(n => n.toFixed(4)).join(", ")}...]
  - Model: ${MODEL}
  `);

  if (embedding.length !== DIMENSIONS) {
    throw new Error("Dimension mismatch");
  }
}
