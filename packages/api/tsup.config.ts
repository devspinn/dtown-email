import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "esnext",
  platform: "neutral",
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  external: ["@hono/node-server"],
  noExternal: [
    "@dtown-email/auth",
    "@dtown-email/db",
    "better-auth",
    "drizzle-orm",
    "@neondatabase/serverless",
  ],
});
