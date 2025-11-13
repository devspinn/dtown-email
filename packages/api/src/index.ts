import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "./router";
import { createContext } from "./context";
import { cors } from "hono/cors";

const app = new Hono();

// Enable CORS for local development
app.use("*", cors());

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
  })
);

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok!" }));

const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;

console.log(`🚀 API server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
export type { AppRouter } from "./router";
