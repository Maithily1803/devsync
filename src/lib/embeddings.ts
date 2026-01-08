// src/lib/embeddings.ts
import { pipeline } from "@xenova/transformers";

let extractor: any = null;

/**
 * Lazy-load embedding model once per process
 */
async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return extractor;
}

/**
 * Generate 384-dim embeddings locally (FREE, unlimited)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length < 10) return [];

  const model = await getExtractor();
  const output = await model(text, {
    pooling: "mean",
    normalize: true,
  });

  const vector = Array.from(output.data as Float32Array);
  return vector.length === 384 ? vector : [];
}
