import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "@yieldplat/db";

type Env = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_URL: string;
};

export function createAuth(env: Env) {
  const db = createDb(env.DATABASE_URL);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: env.BETTER_AUTH_URL || "http://localhost:3000",
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        enabled: true,
      },
    },
    trustedOrigins: [
      "http://localhost:3000",
      "https://e4b90995.yieldplat.pages.dev",
      "https://yieldplat.pages.dev",
      "https://yieldplat-api.devonstownsend.workers.dev",
      "https://www.birthstori.com",
      env.BETTER_AUTH_URL,
    ],
    // advanced: {
    //   useSecureCookies: true,
    //   cookieOptions: {
    //     sameSite: "lax",
    //     secure: true,
    //     domain: env.BETTER_AUTH_URL.includes("birthstori.com")
    //       ? ".birthstori.com"
    //       : undefined,
    //   },
    // },
  });
}
// For development with process.env
export const auth = createAuth({
  DATABASE_URL: process.env.DATABASE_URL!,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
