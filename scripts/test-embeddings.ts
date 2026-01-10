import { generateEmbedding } from "@/lib/embeddings";

(async () => {
  const v = await generateEmbedding(
    "export async function authenticate(req: Request) { return true; }"
  );

  console.log("Length:", v.length);
  console.log("Sample:", v.slice(0, 5));
})();
