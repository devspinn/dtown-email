import { db, schema, eq, and, type EmailAccount } from "@dtown-email/db";
import { GmailService, type EmailMessage } from "./gmail";
import { AIService, type RuleDefinition } from "./ai";

export class EmailProcessor {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  /**
   * Core logic: Process email content against rules and execute actions
   * This is the shared processing logic used by both bulk and single email processing
   */
  private async processEmailAgainstRules(
    emailId: string,
    emailBody: string,
    gmailMessageId: string,
    userId: string,
    gmailService: GmailService
  ): Promise<void> {
    // Fetch active rules for this user, ordered by priority
    const rules = await db
      .select()
      .from(schema.rule)
      .where(
        and(eq(schema.rule.userId, userId), eq(schema.rule.isActive, true))
      )
      .orderBy(schema.rule.priority);

    if (rules.length === 0) {
      console.log(`No active rules for user ${userId}`);
      return;
    }

    // Convert to RuleDefinition format for AI service
    const ruleDefinitions: RuleDefinition[] = rules.map((r) => ({
      id: r.id,
      name: r.name,
      systemPrompt: r.systemPrompt,
      actionType: r.actionType,
      actionValue: r.actionValue,
    }));

    // Classify email against all rules
    console.log(
      `Classifying email ${gmailMessageId} against ${rules.length} rules...`
    );

    const matches = await this.aiService.classifyAgainstRules(
      emailBody,
      ruleDefinitions
    );

    // Execute action for the highest-confidence match (if any)
    if (matches.length === 0) {
      console.log(`No rules matched for email ${gmailMessageId}`);
      return;
    }
    for (const match of matches) {
      console.log(
        `Email matched rule "${match.rule.name}" with ${match.result.confidence}% confidence`
      );

      // Log the match to processed_emails table
      await db.insert(schema.processedEmail).values({
        emailId,
        ruleId: match.rule.id,
        matched: true,
        confidence: match.result.confidence,
        actionTaken: match.rule.actionType,
        llmResponse: JSON.stringify(match.result),
      });

      // Execute the action
      await this.executeAction(
        gmailMessageId,
        match.rule.actionType,
        match.rule.actionValue,
        gmailService
      );
      console.log(
        `Executed action "${match.rule.actionType}" for email ${gmailMessageId}`
      );
    }
  }

  /**
   * Process a single email from Gmail (used for bulk processing)
   */
  async processEmail(
    emailMessage: EmailMessage,
    emailAccount: EmailAccount,
    gmailService: GmailService
  ): Promise<void> {
    // 1. Check if email already exists in DB
    const [existingEmail] = await db
      .select()
      .from(schema.email)
      .where(eq(schema.email.gmailMessageId, emailMessage.id))
      .limit(1);

    let emailId: string;

    if (existingEmail) {
      emailId = existingEmail.id;
      console.log(`Email ${emailMessage.id} already processed, skipping...`);
      return;
    } else {
      // 2. Save email to database
      const [newEmail] = await db
        .insert(schema.email)
        .values({
          gmailMessageId: emailMessage.id,
          emailAccountId: emailAccount.id,
          threadId: emailMessage.threadId,
          from: emailMessage.from,
          to: emailMessage.to,
          subject: emailMessage.subject,
          snippet: emailMessage.snippet,
          bodyText: emailMessage.bodyText,
          bodyHtml: emailMessage.bodyHtml,
          labelIds: JSON.stringify(emailMessage.labelIds),
          receivedAt: emailMessage.receivedAt,
          isRead: emailMessage.isRead,
          isStarred: emailMessage.isStarred,
        })
        .returning();

      emailId = newEmail.id;
    }

    // 2.5. Check if this thread has been user-muted
    // If the first email in the thread has the user-muted label, automatically archive subsequent emails
    if (emailMessage.threadId) {
      const firstEmailInThread = await db
        .select()
        .from(schema.email)
        .where(
          and(
            eq(schema.email.threadId, emailMessage.threadId),
            eq(schema.email.emailAccountId, emailAccount.id)
          )
        )
        .orderBy(schema.email.receivedAt)
        .limit(1);

      if (
        firstEmailInThread.length > 0 &&
        firstEmailInThread[0].id !== emailId
      ) {
        // This is not the first email in the thread
        const firstEmailLabels = JSON.parse(
          firstEmailInThread[0].labelIds || "[]"
        );
        console.log(`DELETE_THIS firstEmailLabels:`, firstEmailLabels);

        // Check if user-muted label exists on first email
        // We need to check by label name since label IDs can vary
        if (firstEmailLabels.includes("user-muted")) {
          console.log(
            `Thread ${emailMessage.threadId} is user-muted, auto-archiving and applying label...`
          );

          // Archive and apply user-muted label to this follow-up email
          await gmailService.archiveEmail(emailMessage.id);
          await gmailService.addLabel(emailMessage.id, "user-muted");

          console.log(
            `Auto-archived follow-up email ${emailMessage.id} in muted thread`
          );
          return; // Skip rule processing for muted threads
        }
      }
    } else {
      console.log(
        "DELETE_THIS No threadId for this email, skipping thread mute check ",
        emailMessage.from
      );
    }

    // 3. Process email against all active rules
    await this.processEmailAgainstRules(
      emailId,
      emailMessage.bodyText,
      emailMessage.id,
      emailAccount.userId,
      gmailService
    );

    // 4. Update lastProcessedAt timestamp
    await db
      .update(schema.email)
      .set({ lastProcessedAt: new Date() })
      .where(eq(schema.email.id, emailId));
  }

  /**
   * Execute an action on an email (archive, label, delete, etc.)
   */
  private async executeAction(
    gmailMessageId: string,
    actionType: string,
    actionValue: string | null | undefined,
    gmailService: GmailService
  ): Promise<void> {
    try {
      switch (actionType) {
        case "ARCHIVE":
          await gmailService.archiveEmail(gmailMessageId);
          console.log(`Archived email ${gmailMessageId}`);
          break;

        case "LABEL":
          if (!actionValue) {
            throw new Error("Label action requires actionValue");
          }
          await gmailService.addLabel(gmailMessageId, actionValue);
          console.log(
            `Added label "${actionValue}" to email ${gmailMessageId}`
          );
          break;

        case "DELETE":
          await gmailService.deleteEmail(gmailMessageId);
          console.log(`Deleted email ${gmailMessageId}`);
          break;

        case "ARCHIVE_AND_LABEL":
          if (!actionValue) {
            throw new Error("Archive+Label action requires actionValue");
          }
          await gmailService.addLabel(gmailMessageId, actionValue);
          await gmailService.archiveEmail(gmailMessageId);
          console.log(
            `Archived and labeled "${actionValue}" email ${gmailMessageId}`
          );
          break;

        case "MUTE":
          await gmailService.muteThread(gmailMessageId);
          console.log(`Muted thread for email ${gmailMessageId}`);
          break;

        case "ARCHIVE_LABEL_AND_MUTE":
          if (!actionValue) {
            throw new Error("Archive+Label+Mute action requires actionValue");
          }
          await gmailService.addLabel(gmailMessageId, actionValue);
          await gmailService.muteThread(gmailMessageId);
          console.log(
            `Labeled "${actionValue}", archived, and muted thread for email ${gmailMessageId}`
          );
          break;

        default:
          console.warn(`Unknown action type: ${actionType}`);
      }
    } catch (error) {
      console.error(`Failed to execute action ${actionType}:`, error);
      throw error;
    }
  }

  /**
   * Process a single email by its database ID against all active rules
   */
  async processEmailById(emailId: string, userId: string): Promise<void> {
    // Fetch email from database
    const [email] = await db
      .select()
      .from(schema.email)
      .where(eq(schema.email.id, emailId))
      .limit(1);

    if (!email) {
      throw new Error(`Email with ID ${emailId} not found`);
    }

    console.log(`📧 Processing email: ${email.subject}`);
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

    // Process email against all active rules (shared logic)
    await this.processEmailAgainstRules(
      emailId,
      email.bodyText,
      email.gmailMessageId,
      userId,
      gmailService
    );

    // Update lastProcessedAt timestamp
    await db
      .update(schema.email)
      .set({ lastProcessedAt: new Date() })
      .where(eq(schema.email.id, emailId));

    console.log(`✅ Email processed and lastProcessedAt updated`);
  }

  /**
   * Process recent emails for a user (assumes one email account per user)
   */
  async processUserEmails(userId: string, maxEmails = 10): Promise<void> {
    // Get the user's email account (assumes one per user)
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

    const gmailService = new GmailService({
      accessToken: emailAccount.accessToken,
      refreshToken: emailAccount.refreshToken,
      expiryDate: emailAccount.tokenExpiresAt?.getTime(),
    });

    console.log(
      `Fetching ${maxEmails} recent emails for ${emailAccount.email}...`
    );
    const emails = await gmailService.fetchRecentEmails(maxEmails);
    console.log(`Found ${emails.length} emails to process`);

    // Process each email
    for (const email of emails) {
      try {
        await this.processEmail(email, emailAccount, gmailService);
      } catch (error) {
        console.error(`Failed to process email ${email.id}:`, error);
        // Continue processing other emails even if one fails
      }
    }
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
