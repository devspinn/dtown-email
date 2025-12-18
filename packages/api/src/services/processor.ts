import { db, schema, eq, and, type EmailAccount } from "@dtown-email/db";
import { GmailService, type EmailMessage } from "./gmail";
import { AIService, type RuleDefinition } from "./ai";

export class EmailProcessor {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }


  /**
   * Execute an action on an email (archive, label, delete, etc.)
   */
  async executeAction(
    gmailMessageId: string,
    threadId: string,
    gmailService: GmailService,
    actionType: string,
    actionValue?: string
  ): Promise<void> {
    try {
      switch (actionType) {
        case "LABEL":
          if (!actionValue) {
            throw new Error("LABEL action requires actionValue (label name)");
          }
          await gmailService.addLabel(gmailMessageId, actionValue);
          console.log(
            `✅ Added label "${actionValue}" to email ${gmailMessageId}`
          );
          break;

        case "LABEL_AND_ARCHIVE":
          await gmailService.archiveEmail(gmailMessageId);
          console.log(
            `✅ Labeled "${actionValue}" and archived email ${gmailMessageId}`
          );
          break;

        case "LABEL_AND_MUTE":
          await gmailService.muteThread(threadId);
          console.log(
            `✅ Labeled "${actionValue}" and muted thread ${threadId} (email ${gmailMessageId})`
          );
          break;

        default:
          console.warn(`⚠️ Unknown action type: ${actionType}`);
          throw new Error(`Unknown action type: ${actionType}`);
      }
    } catch (error) {
      console.error(`❌ Failed to execute action ${actionType}:`, error);
      throw error;
    }
  }

  /**
   * Process a single email by its database ID against all active rules
   * Email must already be synced to the database
   * Always applies 'prcsd-dtown' label to mark as processed
   */
  async processEmailById(emailId: string, userId: string): Promise<void> {
    console.log(`\n⚡ Processing email ${emailId}...`);

    // Fetch email from database
    const [email] = await db
      .select()
      .from(schema.email)
      .where(eq(schema.email.id, emailId))
      .limit(1);

    if (!email) {
      throw new Error(`Email with ID ${emailId} not found in database`);
    }

    console.log(`📧 Email: ${email.subject}`);
    console.log(`   From: ${email.from}`);

    // Get the user's email account
    const [emailAccount] = await db
      .select()
      .from(schema.emailAccount)
      .where(eq(schema.emailAccount.userId, userId))
      .limit(1);

    if (!emailAccount) {
      throw new Error(`No email account found for user ${userId}`);
    }

    if (!emailAccount.accessToken || !emailAccount.refreshToken) {
      throw new Error("Email account missing OAuth tokens");
    }

    // Create Gmail service
    const gmailService = new GmailService({
      accessToken: emailAccount.accessToken,
      refreshToken: emailAccount.refreshToken,
      expiryDate: emailAccount.tokenExpiresAt?.getTime(),
    });

    // Fetch active rules for this user, ordered by priority
    const rules = await db
      .select()
      .from(schema.rule)
      .where(and(eq(schema.rule.userId, userId), eq(schema.rule.isActive, true)))
      .orderBy(schema.rule.priority);

    console.log(`📋 Found ${rules.length} active rules`);

    let hasMatches = false;

    if (rules.length > 0) {
      // Convert to RuleDefinition format for AI service
      const ruleDefinitions: RuleDefinition[] = rules.map((r) => ({
        id: r.id,
        name: r.name,
        systemPrompt: r.systemPrompt,
        actionType: r.actionType,
        actionValue: r.actionValue,
      }));

      // Classify email against all rules
      console.log(`🤖 Classifying email against rules...`);

      const matches = await this.aiService.classifyAgainstRules(
        email.bodyText || "[No body text]",
        ruleDefinitions
      );

      if (matches.length > 0) {
        hasMatches = true;

        // Execute actions for all matches
        for (const match of matches) {
          console.log(
            `✅ Matched rule "${match.rule.name}" (${match.result.confidence}% confidence)`
          );

          // Log the execution to rule_execution table
          await db.insert(schema.ruleExecution).values({
            emailId,
            ruleId: match.rule.id,
            matched: true,
            confidence: match.result.confidence,
            reasoning: match.result.reasoning,
            actionTaken: match.rule.actionType,
            llmResponse: JSON.stringify(match.result),
          });

          // Execute the action
          await this.executeAction(
            email.gmailMessageId,
            email.threadId,
            gmailService,
            match.rule.actionType,
            match.rule.actionValue || undefined
          );
        }
      }
    }

    if (!hasMatches) {
      console.log(`⚪ No rules matched for this email`);
    }

    // Always apply 'prcsd-dtown' label to mark as processed
    await gmailService.addLabel(email.gmailMessageId, "prcsd-dtown");
    console.log(`✅ Applied 'prcsd-dtown' label`);

    console.log(`✅ Email processing complete\n`);
  }


  /**
   * Sync emails from Gmail to database WITHOUT processing them against rules
   * This is useful for the test rule feature
   */
  async syncEmails(
    emailAccount: EmailAccount,
    maxEmails = 50
  ): Promise<number> {
    if (!emailAccount.accessToken || !emailAccount.refreshToken) {
      throw new Error("Email account missing OAuth tokens");
    }

    const gmailService = new GmailService({
      accessToken: emailAccount.accessToken,
      refreshToken: emailAccount.refreshToken,
      expiryDate: emailAccount.tokenExpiresAt?.getTime(),
    });

    console.log(
      `\n📥 Syncing ${maxEmails} emails from Gmail for ${emailAccount.email}...`
    );
    const emails = await gmailService.fetchRecentEmails(maxEmails);
    console.log(`📧 Fetched ${emails.length} emails from Gmail`);

    let newEmailCount = 0;
    let updatedCount = 0;

    // Save or update each email in database
    for (const email of emails) {
      console.log(`Syncing email ${email.id} - ${email.subject}`);
      console.log(email.labelIds);
      try {
        // Check if email already exists
        const [existingEmail] = await db
          .select()
          .from(schema.email)
          .where(eq(schema.email.gmailMessageId, email.id))
          .limit(1);

        if (existingEmail) {
          console.log(`Email ${email.id} exists, updating...`);
          // Update existing email with latest attributes from Gmail
          await db
            .update(schema.email)
            .set({
              labelIds: JSON.stringify(email.labelIds),
              isRead: email.isRead,
              isStarred: email.isStarred,
              snippet: email.snippet,
              bodyText: email.bodyText,
              bodyHtml: email.bodyHtml,
            })
            .where(eq(schema.email.id, existingEmail.id));

          updatedCount++;
        } else {
          console.log(`Email ${email.id} is new, inserting...`);
          // Save new email to database
          await db.insert(schema.email).values({
            gmailMessageId: email.id,
            emailAccountId: emailAccount.id,
            threadId: email.threadId,
            from: email.from,
            to: email.to,
            subject: email.subject,
            snippet: email.snippet,
            bodyText: email.bodyText,
            bodyHtml: email.bodyHtml,
            labelIds: JSON.stringify(email.labelIds),
            receivedAt: email.receivedAt,
            isRead: email.isRead,
            isStarred: email.isStarred,
          });

          newEmailCount++;
        }
      } catch (error) {
        console.error(`Failed to sync email ${email.id}:`, error);
        // Continue with other emails
      }
    }

    console.log(
      `✅ Sync complete: ${newEmailCount} new emails, ${updatedCount} updated`
    );
    return newEmailCount;
  }
}
