import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { type Context } from "./context";
import { schema, eq, desc } from "@dtown-email/db";
import { EmailProcessor } from "./services/processor";
import { AIService } from "./services/ai";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    console.error("❌ tRPC Error:", {
      path: shape.data.path,
      code: error.code,
      message: error.message,
    });
    return shape;
  },
});

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
          actionType: z.enum([
            "ARCHIVE",
            "LABEL",
            "DELETE",
            "ARCHIVE_AND_LABEL",
            "MUTE",
            "ARCHIVE_LABEL_AND_MUTE",
          ]),
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
          actionType: z
            .enum([
              "ARCHIVE",
              "LABEL",
              "DELETE",
              "ARCHIVE_AND_LABEL",
              "MUTE",
              "ARCHIVE_LABEL_AND_MUTE",
            ])
            .optional(),
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
        const systemPrompt = await aiService.generateSystemPrompt(
          input.description
        );
        return { systemPrompt };
      }),

    // Test a rule against recent emails
    test: t.procedure
      .input(
        z.object({
          ruleId: z.string(),
          limit: z.number().default(20),
        })
      )
      .mutation(async ({ ctx, input }) => {
        console.log("\n🧪 ========== STARTING RULE TEST ==========");
        console.log(`📋 Rule ID: ${input.ruleId}`);
        console.log(`📊 Testing limit: ${input.limit} emails`);

        const aiService = new AIService();

        // Fetch the rule
        const [rule] = await ctx.db
          .select()
          .from(schema.rule)
          .where(eq(schema.rule.id, input.ruleId))
          .limit(1);

        if (!rule) {
          console.error("❌ Rule not found");
          throw new Error("Rule not found");
        }

        console.log(`✅ Found rule: "${rule.name}"`);
        console.log(
          `📝 System prompt: ${rule.systemPrompt.substring(0, 100)}...`
        );

        // Get the user's email account (one per user)
        const [emailAccount] = await ctx.db
          .select()
          .from(schema.emailAccount)
          .where(eq(schema.emailAccount.userId, rule.userId))
          .limit(1);

        if (!emailAccount) {
          console.warn("⚠️  No email account found for user");
          return { results: [], matchCount: 0, total: 0 };
        }

        console.log(`📧 Email account: ${emailAccount.email}`);

        // Always sync latest emails from Gmail before testing
        console.log(`📥 Syncing latest ${input.limit} emails from Gmail...`);
        const processor = new EmailProcessor();

        try {
          const syncCount = await processor.syncEmails(
            emailAccount,
            input.limit
          );
          console.log(`✅ Synced ${syncCount} new emails from Gmail`);
        } catch (error) {
          console.error("❌ Failed to sync emails:", error);
          throw new Error("Failed to sync emails from Gmail");
        }

        // Get recent emails from the database (after sync)
        const recentEmails = await ctx.db
          .select()
          .from(schema.email)
          .where(eq(schema.email.emailAccountId, emailAccount.id))
          .orderBy(desc(schema.email.receivedAt))
          .limit(input.limit);

        if (recentEmails.length === 0) {
          console.error("❌ No emails found after sync");
          return { results: [], matchCount: 0, total: 0 };
        }

        console.log(
          `\n📬 Testing against ${recentEmails.length} emails from database`
        );
        console.log("🤖 Starting AI classification...\n");

        // Test each email against the rule
        let processedCount = 0;
        const results = await Promise.all(
          recentEmails.map(async (email, index) => {
            const emailNum = index + 1;
            console.log(`[${emailNum}/${recentEmails.length}] 🔍 Classifying:`);
            console.log(`    From: ${email.from}`);
            console.log(`    Subject: ${email.subject}`);

            try {
              const startTime = Date.now();
              const classification = await aiService.classifyEmail(
                email.bodyText || email.snippet || "",
                {
                  id: rule.id,
                  name: rule.name,
                  systemPrompt: rule.systemPrompt,
                  actionType: rule.actionType,
                  actionValue: rule.actionValue,
                }
              );
              const duration = Date.now() - startTime;

              if (classification.matched) {
                console.log(
                  `    ✅ MATCH (${classification.confidence}% confidence, ${duration}ms) (${email.from})`
                );
              } else {
                console.log(`    ⚪ No match (${duration}ms) (${email.from})`);
              }
              if (classification.reasoning) {
                console.log(`    💭 Reasoning: ${classification.reasoning}`);
              }

              processedCount++;
              return {
                email: {
                  id: email.id,
                  gmailMessageId: email.gmailMessageId,
                  from: email.from,
                  subject: email.subject,
                  snippet: email.snippet,
                  receivedAt: email.receivedAt,
                },
                matched: classification.matched,
                confidence: classification.confidence,
                reasoning: classification.reasoning,
                error: null,
              };
            } catch (error) {
              console.error(
                `    ❌ ERROR: ${error instanceof Error ? error.message : "Unknown error"}`
              );
              processedCount++;
              return {
                email: {
                  id: email.id,
                  gmailMessageId: email.gmailMessageId,
                  from: email.from,
                  subject: email.subject,
                  snippet: email.snippet,
                  receivedAt: email.receivedAt,
                },
                matched: false,
                confidence: 0,
                reasoning: null,
                error:
                  error instanceof Error
                    ? error.message
                    : "Classification failed",
              };
            }
          })
        );

        const matchCount = results.filter((r) => r.matched).length;

        console.log(`\n📊 ========== TEST COMPLETE ========== ${rule.name}`);
        console.log(
          `✅ Processed: ${processedCount}/${recentEmails.length} emails`
        );
        console.log(`🎯 Matches: ${matchCount}`);
        console.log(`⚪ Non-matches: ${results.length - matchCount}`);
        console.log(
          `📈 Match rate: ${((matchCount / results.length) * 100).toFixed(1)}%`
        );
        console.log("========================================\n");

        return {
          results,
          matchCount,
          total: recentEmails.length,
          rule: {
            id: rule.id,
            name: rule.name,
            actionType: rule.actionType,
            actionValue: rule.actionValue,
          },
        };
      }),

    // Apply a rule to specific emails
    applyToEmails: t.procedure
      .input(
        z.object({
          ruleId: z.string(),
          emailIds: z.array(z.string()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        console.log("\n⚡ ========== APPLYING RULE TO EMAILS ==========");
        console.log(`📋 Rule ID: ${input.ruleId}`);
        console.log(`📧 Number of emails: ${input.emailIds.length}`);

        const processor = new EmailProcessor();

        // Fetch the rule
        const [rule] = await ctx.db
          .select()
          .from(schema.rule)
          .where(eq(schema.rule.id, input.ruleId))
          .limit(1);

        if (!rule) {
          console.error("❌ Rule not found");
          throw new Error("Rule not found");
        }

        console.log(`✅ Found rule: "${rule.name}"`);
        console.log(
          `🎯 Action: ${rule.actionType}${rule.actionValue ? ` (${rule.actionValue})` : ""}`
        );

        // Get the user's email account (one per user)
        const [emailAccount] = await ctx.db
          .select()
          .from(schema.emailAccount)
          .where(eq(schema.emailAccount.userId, rule.userId))
          .limit(1);

        if (!emailAccount) {
          console.error("❌ No email account found");
          throw new Error("No email account found");
        }

        console.log(`📬 Email account: ${emailAccount.email}`);

        let processed = 0;

        // Import GmailService here
        const { GmailService } = await import("./services/gmail");

        const gmailService = new GmailService({
          accessToken: emailAccount.accessToken!,
          refreshToken: emailAccount.refreshToken!,
          expiryDate: emailAccount.tokenExpiresAt?.getTime(),
        });

        console.log("\n🚀 Processing emails...\n");

        // Process each email
        for (let i = 0; i < input.emailIds.length; i++) {
          const emailId = input.emailIds[i];
          console.log(
            `[${i + 1}/${input.emailIds.length}] Processing email ID: ${emailId}`
          );

          try {
            const [email] = await ctx.db
              .select()
              .from(schema.email)
              .where(eq(schema.email.id, emailId))
              .limit(1);

            if (!email) {
              console.warn(`    ⚠️  Email not found in database, skipping`);
              continue;
            }

            console.log(`    From: ${email.from}`);
            console.log(`    Subject: ${email.subject}`);

            const startTime = Date.now();

            // Execute the action using shared processor logic
            await processor.executeAction(
              email.gmailMessageId,
              email.threadId,
              rule.actionType,
              rule.actionValue,
              gmailService
            );
            console.log(
              `    ✅ Action "${rule.actionType}" executed (${Date.now() - startTime}ms)`
            );

            // Log to processed_email table for audit trail
            await ctx.db.insert(schema.processedEmail).values({
              emailId: email.id,
              ruleId: input.ruleId,
              matched: true, // User manually selected this email
              confidence: null, // Not re-running AI classification
              actionTaken: rule.actionType,
              llmResponse: null, // Not available in apply flow
            });

            console.log(`    📝 Logged to audit trail`);
            processed++;
          } catch (error) {
            console.error(
              `    ❌ ERROR: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        }

        console.log("\n📊 ========== APPLY COMPLETE ==========");
        console.log(
          `✅ Successfully processed: ${processed}/${input.emailIds.length} emails`
        );
        if (processed < input.emailIds.length) {
          console.log(`⚠️  Failed: ${input.emailIds.length - processed}`);
        }
        console.log("========================================\n");

        return { success: true, processed };
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
        // Get the user's email account (one per user)
        const [account] = await ctx.db
          .select()
          .from(schema.emailAccount)
          .where(eq(schema.emailAccount.userId, input.userId))
          .limit(1);

        if (!account) {
          return [];
        }

        // Get emails for this account
        return ctx.db
          .select()
          .from(schema.email)
          .where(eq(schema.email.emailAccountId, account.id))
          .orderBy(desc(schema.email.receivedAt))
          .limit(input.limit);
      }),

    // Sync emails from Gmail without processing
    sync: t.procedure
      .input(
        z.object({
          userId: z.string(),
          maxEmails: z.number().default(50),
        })
      )
      .mutation(async ({ ctx, input }) => {
        console.log(`\n🔄 ========== SYNCING EMAILS ==========`);
        console.log(`👤 User ID: ${input.userId}`);
        console.log(`📊 Max emails: ${input.maxEmails}`);

        const processor = new EmailProcessor();

        // Get the user's email account (one per user)
        const [emailAccount] = await ctx.db
          .select()
          .from(schema.emailAccount)
          .where(eq(schema.emailAccount.userId, input.userId))
          .limit(1);

        if (!emailAccount) {
          console.error("❌ No email account found for user");
          throw new Error(
            "No email account found. Please connect your Gmail account."
          );
        }

        console.log(`📧 Email account: ${emailAccount.email}`);

        try {
          const newEmailCount = await processor.syncEmails(
            emailAccount,
            input.maxEmails
          );

          console.log(`\n✅ ========== SYNC COMPLETE ==========`);
          console.log(`📥 Synced ${newEmailCount} new emails`);
          console.log(`=====================================\n`);

          return {
            success: true,
            newEmailCount,
            message: `Synced ${newEmailCount} new emails from Gmail`,
          };
        } catch (error) {
          console.error("❌ Sync failed:", error);
          throw error;
        }
      }),

    processNow: t.procedure
      .input(
        z.object({
          userId: z.string(),
          maxEmails: z.number().default(10),
        })
      )
      .mutation(async ({ input }) => {
        const processor = new EmailProcessor();
        await processor.processUserEmails(input.userId, input.maxEmails);
        return { success: true, message: "Email processing started" };
      }),

    // Process a single email by ID
    processOne: t.procedure
      .input(
        z.object({
          emailId: z.string(),
          userId: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        console.log(`\n⚡ ========== PROCESSING SINGLE EMAIL ==========`);
        console.log(`📧 Email ID: ${input.emailId}`);
        console.log(`👤 User ID: ${input.userId}`);

        const processor = new EmailProcessor();

        try {
          await processor.processEmailById(input.emailId, input.userId);

          console.log(`\n✅ ========== PROCESSING COMPLETE ==========`);
          console.log(`==========================================\n`);

          return { success: true, message: "Email processed successfully" };
        } catch (error) {
          console.error("❌ Processing failed:", error);
          throw error;
        }
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
        // Get processed emails with email and rule details
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
          .innerJoin(
            schema.email,
            eq(schema.processedEmail.emailId, schema.email.id)
          )
          .innerJoin(
            schema.rule,
            eq(schema.processedEmail.ruleId, schema.rule.id)
          )
          .where(eq(schema.rule.userId, input.userId))
          .orderBy(desc(schema.processedEmail.processedAt))
          .limit(input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
