import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "./router";
import { createContext } from "./context";
import { cors } from "hono/cors";
import { createAuth } from "@yieldplat/auth";

type Bindings = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS - allow both production and development origins
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "https://e4b90995.yieldplat.pages.dev",
        "https://yieldplat.pages.dev",
        "https://yieldplat-api.devonstownsend.workers.dev",
        "https://lh3.googleusercontent.com",
        "https://www.birthstori.com",
        "https://api.birthstori.com",
        c.env?.BETTER_AUTH_URL,
      ].filter(Boolean);

      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      return allowedOrigins[0];
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Better Auth endpoints - catch all routes under /api/auth (including nested paths)
app.all("/api/auth/**", async (context) => {
  try {
    const auth = createAuth(context.env);
    const response = await auth.handler(context.req.raw);
    return response;
  } catch (error) {
    console.error("Auth handler error:", error);
    return context.json(
      { error: "Auth handler failed", details: error.message },
      500
    );
  }
});

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (opts, c) => {
      return createContext(c.env);
    },
  })
);

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok!" }));

// Export for Cloudflare Workers
export default app;
export type { AppRouter } from "./router";
