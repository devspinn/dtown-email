// Development server only - not bundled for Workers
import { serve } from "@hono/node-server";
import app from "./index";

const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;

console.log(`🚀 API server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
