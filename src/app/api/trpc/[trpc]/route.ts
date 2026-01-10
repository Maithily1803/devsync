import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

const handler = async (req: NextRequest) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => createTRPCContext(),
    onError({ path, error }) {
      console.error(`tRPC failed on ${path ?? "<no-path>"}:`, error);
    },
  });
};

export { handler as GET, handler as POST };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
