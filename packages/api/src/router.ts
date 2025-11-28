import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { type Context } from "./context";
import { schema, eq, and, desc } from "@dtown-email/db";
import { EmailProcessor } from "./services/processor";
import { AIService } from "./services/ai";

const t = initTRPC.context<Context>().create();

export const appRouter = t.router({
  hello: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => `Hello ${input.name}`),

  users: t.router({
    list: t.procedure.query(async ({ ctx }) => {
      const users = await ctx.db.select().from(schema.user);
      return users;
    }),

    create: t.procedure
      .input(
        z.object({
          email: z.string().email(),
          name: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const [newUser] = await ctx.db
          .insert(schema.user)
          .values(input)
          .returning();
        return newUser;
      }),
  }),

  // Email account management
  emailAccounts: t.router({
    list: t.procedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.db
          .select()
          .from(schema.emailAccount)
          .where(eq(schema.emailAccount.userId, input.userId));
      }),

    create: t.procedure
      .input(
        z.object({
          userId: z.string(),
          email: z.string().email(),
          accessToken: z.string(),
          refreshToken: z.string(),
          tokenExpiresAt: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const [account] = await ctx.db
          .insert(schema.emailAccount)
          .values(input)
          .returning();
        return account;
      }),

    delete: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db
          .delete(schema.emailAccount)
          .where(eq(schema.emailAccount.id, input.id));
        return { success: true };
      }),
  }),

  // Email rule management
  rules: t.router({
    list: t.procedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.db
          .select()
          .from(schema.rule)
          .where(eq(schema.rule.userId, input.userId))
          .orderBy(schema.rule.priority);
      }),

    create: t.procedure
      .input(
        z.object({
          userId: z.string(),
          name: z.string(),
          description: z.string().optional(),
          systemPrompt: z.string(),
          actionType: z.enum(["ARCHIVE", "LABEL", "DELETE", "ARCHIVE_AND_LABEL"]),
          actionValue: z.string().optional(),
          priority: z.number().default(0),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const [rule] = await ctx.db
          .insert(schema.rule)
          .values(input)
          .returning();
        return rule;
      }),

    update: t.procedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().optional(),
          description: z.string().optional(),
          systemPrompt: z.string().optional(),
          actionType: z.enum(["ARCHIVE", "LABEL", "DELETE", "ARCHIVE_AND_LABEL"]).optional(),
          actionValue: z.string().optional(),
          isActive: z.boolean().optional(),
          priority: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        const [rule] = await ctx.db
          .update(schema.rule)
          .set(updates)
          .where(eq(schema.rule.id, id))
          .returning();
        return rule;
      }),

    delete: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db.delete(schema.rule).where(eq(schema.rule.id, input.id));
        return { success: true };
      }),

    // Generate system prompt from natural language
    generatePrompt: t.procedure
      .input(z.object({ description: z.string() }))
      .mutation(async ({ input }) => {
        const aiService = new AIService();
        const systemPrompt = await aiService.generateSystemPrompt(input.description);
        return { systemPrompt };
      }),
  }),

  // Email processing
  emails: t.router({
    list: t.procedure
      .input(
        z.object({
          userId: z.string(),
          limit: z.number().default(50),
        })
      )
      .query(async ({ ctx, input }) => {
        // Get user's email accounts
        const accounts = await ctx.db
          .select()
          .from(schema.emailAccount)
          .where(eq(schema.emailAccount.userId, input.userId));

        if (accounts.length === 0) {
          return [];
        }

        // Get emails for these accounts
        const accountIds = accounts.map((a) => a.id);
        return ctx.db
          .select()
          .from(schema.email)
          .where(
            eq(
              schema.email.emailAccountId,
              accountIds[0] // TODO: Handle multiple accounts properly
            )
          )
          .orderBy(desc(schema.email.receivedAt))
          .limit(input.limit);
      }),

    processNow: t.procedure
      .input(
        z.object({
          userId: z.string(),
          maxEmailsPerAccount: z.number().default(10),
        })
      )
      .mutation(async ({ input }) => {
        const processor = new EmailProcessor();
        await processor.processUserEmails(input.userId, input.maxEmailsPerAccount);
        return { success: true, message: "Email processing started" };
      }),
  }),

  // Processed emails (audit trail)
  processed: t.router({
    list: t.procedure
      .input(
        z.object({
          userId: z.string(),
          limit: z.number().default(100),
        })
      )
      .query(async ({ ctx, input }) => {
        // Get user's email accounts
        const accounts = await ctx.db
          .select()
          .from(schema.emailAccount)
          .where(eq(schema.emailAccount.userId, input.userId));

        if (accounts.length === 0) {
          return [];
        }

        // Get processed emails
        return ctx.db
          .select({
            id: schema.processedEmail.id,
            matched: schema.processedEmail.matched,
            confidence: schema.processedEmail.confidence,
            actionTaken: schema.processedEmail.actionTaken,
            processedAt: schema.processedEmail.processedAt,
            email: schema.email,
            rule: schema.rule,
          })
          .from(schema.processedEmail)
          .innerJoin(schema.email, eq(schema.processedEmail.emailId, schema.email.id))
          .innerJoin(schema.rule, eq(schema.processedEmail.ruleId, schema.rule.id))
          .where(eq(schema.rule.userId, input.userId))
          .orderBy(desc(schema.processedEmail.processedAt))
          .limit(input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
