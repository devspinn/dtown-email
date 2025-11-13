import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@yieldplat/api";

// Create tRPC React hooks
export const trpc = createTRPCReact<AppRouter>();

// Create tRPC client
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "http://localhost:3002/trpc",
    }),
  ],
});
