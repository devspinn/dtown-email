import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// Better Auth Users table
export const user = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  password: text("password"),
});

// Better Auth Sessions table
export const session = pgTable("session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

// Better Auth Accounts table (for OAuth providers)
export const account = pgTable("account", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// Better Auth Verification table
export const verification = pgTable("verification", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Email Accounts table - stores connected Gmail accounts
export const emailAccount = pgTable("email_account", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  provider: text("provider").notNull().default("gmail"), // 'gmail' for now
  accessToken: text("accessToken"), // Encrypted in production
  refreshToken: text("refreshToken"), // Encrypted in production
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  lastSyncAt: timestamp("lastSyncAt"),
  historyId: text("historyId"), // Gmail history ID for incremental sync
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// Email Rules table - user-defined AI filtering rules
export const rule = pgTable("rule", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "Cold Sales Filter"
  description: text("description"), // User's natural language description
  systemPrompt: text("systemPrompt").notNull(), // The actual prompt sent to Claude
  actionType: text("actionType", {
    enum: ["LABEL", "LABEL_AND_ARCHIVE", "LABEL_AND_MUTE"],
  }).notNull(),
  actionValue: text("actionValue").notNull(), // Label name (required for all actions)
  isActive: boolean("isActive").notNull().default(true),
  priority: integer("priority").notNull().default(0), // Order of rule execution
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// Emails table - cached emails from Gmail (read-only cache, no first-party data)
export const email = pgTable("email", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  gmailMessageId: text("gmailMessageId").notNull().unique(), // Gmail's message ID
  emailAccountId: text("emailAccountId")
    .notNull()
    .references(() => emailAccount.id, { onDelete: "cascade" }),
  threadId: text("threadId").notNull(),
  from: text("from").notNull(),
  to: text("to"),
  subject: text("subject"),
  snippet: text("snippet"), // Preview text
  bodyText: text("bodyText"), // Plain text body for AI processing
  bodyHtml: text("bodyHtml"), // HTML body for display
  labelIds: text("labelIds"), // JSON array of Gmail labels
  receivedAt: timestamp("receivedAt").notNull(),
  isRead: boolean("isRead").notNull().default(false),
  isStarred: boolean("isStarred").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// Rule Executions table - audit trail of all rule executions
// Multiple rules can be executed against a single email
export const ruleExecution = pgTable("rule_execution", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  emailId: text("emailId")
    .notNull()
    .references(() => email.id, { onDelete: "cascade" }),
  ruleId: text("ruleId")
    .notNull()
    .references(() => rule.id, { onDelete: "cascade" }),
  matched: boolean("matched").notNull(), // Did the email match the rule?
  confidence: integer("confidence"), // Confidence score (0-100)
  reasoning: text("reasoning"), // AI's reasoning for the decision
  actionTaken: text("actionTaken"), // What action was performed (ARCHIVE, LABEL, etc.)
  llmResponse: text("llmResponse"), // Full LLM response for debugging
  executedAt: timestamp("executedAt").notNull().defaultNow(),
});

// Type exports for use in the application
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type EmailAccount = typeof emailAccount.$inferSelect;
export type NewEmailAccount = typeof emailAccount.$inferInsert;
export type Rule = typeof rule.$inferSelect;
export type NewRule = typeof rule.$inferInsert;
export type Email = typeof email.$inferSelect;
export type NewEmail = typeof email.$inferInsert;
export type RuleExecution = typeof ruleExecution.$inferSelect;
export type NewRuleExecution = typeof ruleExecution.$inferInsert;
