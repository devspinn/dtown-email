import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@yieldplat/api";

// Create tRPC React hooks
export const trpc = createTRPCReact<AppRouter>();

// Get API URL based on environment
const getApiUrl = () => {
  // In production, use the custom domain
  if (import.meta.env.PROD) {
    return "https://api.birthstori.com/trpc";
  }
  // In development, use the proxy
  return "/api/trpc";
};

// Create tRPC client
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: getApiUrl(),
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});
