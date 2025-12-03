import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb, schema, eq, and, createId } from "@dtown-email/db";

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
        scope: [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.modify",
          "https://www.googleapis.com/auth/gmail.labels",
        ],
        accessType: "offline",
        prompt: "consent",
      },
    },
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:3002",
      "https://dtown-email-web.pages.dev",
      "https://dtown-email-api.devonstownsend.workers.dev",
      "https://www.bddbapp.com",
      env.BETTER_AUTH_URL,
    ],
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        console.log(`Auth event: ${ctx.path}`);
        // console.log(JSON.stringify(ctx.context, null, 2));
        if (ctx.path === "/callback/:id") {
          console.log(`GOT A MATCH`);
          console.log(JSON.stringify(ctx.context, null, 2));

          // Extract user and account info from the callback context
          const userId = ctx.context?.newSession?.user?.id;
          const userEmail = ctx.context?.newSession?.user?.email;

          if (!userId || !userEmail) {
            console.log("⚠️ No user ID or email in OAuth callback context");
            return;
          }

          console.log(`\n✅ Google OAuth callback for user: ${userEmail}`);

          try {
            // Check if emailAccount already exists
            const existingAccount = await db
              .select()
              .from(schema.emailAccount)
              .where(
                and(
                  eq(schema.emailAccount.userId, userId),
                  eq(schema.emailAccount.email, userEmail)
                )
              )
              .limit(1);

            if (existingAccount.length > 0) {
              console.log(`📧 Email account already exists for ${userEmail}`);

              // Update tokens in case they were refreshed
              const oauthAccount = await db
                .select()
                .from(schema.account)
                .where(
                  and(
                    eq(schema.account.userId, userId),
                    eq(schema.account.providerId, "google")
                  )
                )
                .limit(1);

              if (oauthAccount.length > 0 && oauthAccount[0].accessToken) {
                await db
                  .update(schema.emailAccount)
                  .set({
                    accessToken: oauthAccount[0].accessToken,
                    refreshToken: oauthAccount[0].refreshToken,
                    tokenExpiresAt: oauthAccount[0].accessTokenExpiresAt,
                    updatedAt: new Date(),
                  })
                  .where(eq(schema.emailAccount.id, existingAccount[0].id));

                console.log(`🔄 Updated OAuth tokens for ${userEmail}`);
              }
              return;
            }

            // Fetch the OAuth account record that Better Auth created
            const oauthAccount = await db
              .select()
              .from(schema.account)
              .where(
                and(
                  eq(schema.account.userId, userId),
                  eq(schema.account.providerId, "google")
                )
              )
              .limit(1);

            if (oauthAccount.length === 0) {
              console.error("❌ No OAuth account found for user");
              return;
            }

            const account = oauthAccount[0];
            console.log(`Account is here: ${JSON.stringify(account, null, 2)}`);

            if (!account.accessToken || !account.refreshToken) {
              console.error("❌ OAuth account missing access token");
              return;
            }
            if (!account.refreshToken) {
              console.error("❌ OAuth account missing refresh token");
              return;
            }

            // Create emailAccount record
            const [newEmailAccount] = await db
              .insert(schema.emailAccount)
              .values({
                id: createId(),
                userId: userId,
                email: userEmail,
                provider: "gmail",
                accessToken: account.accessToken,
                refreshToken: account.refreshToken,
                tokenExpiresAt: account.accessTokenExpiresAt,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();

            console.log(`✅ Created emailAccount for ${userEmail}`);
            console.log(`📧 Email Account ID: ${newEmailAccount.id}`);
          } catch (error) {
            console.error("❌ Error creating emailAccount:", error);
          }
        }
      }),
    },
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
