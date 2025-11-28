import { db, schema, eq, and, type Rule, type EmailAccount } from "@dtown-email/db";
import { GmailService, type EmailMessage } from "./gmail";
import { AIService, type RuleDefinition } from "./ai";

export class EmailProcessor {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  /**
   * Process a single email against all active rules for a user
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

    // 3. Fetch active rules for this user, ordered by priority
    const rules = await db
      .select()
      .from(schema.rule)
      .where(
        and(
          eq(schema.rule.userId, emailAccount.userId),
          eq(schema.rule.isActive, true)
        )
      )
      .orderBy(schema.rule.priority);

    if (rules.length === 0) {
      console.log(`No active rules for user ${emailAccount.userId}`);
      return;
    }

    // 4. Convert to RuleDefinition format for AI service
    const ruleDefinitions: RuleDefinition[] = rules.map((r) => ({
      id: r.id,
      name: r.name,
      systemPrompt: r.systemPrompt,
      actionType: r.actionType,
      actionValue: r.actionValue,
    }));

    // 5. Classify email against all rules
    console.log(`Classifying email ${emailMessage.id} against ${rules.length} rules...`);

    const matches = await this.aiService.classifyAgainstRules(
      emailMessage.bodyText,
      ruleDefinitions
    );

    // 6. Execute action for the highest-confidence match (if any)
    if (matches.length > 0) {
      const bestMatch = matches[0];
      console.log(
        `Email matched rule "${bestMatch.rule.name}" with ${bestMatch.result.confidence}% confidence`
      );

      // Log the match to processed_emails table
      await db.insert(schema.processedEmail).values({
        emailId,
        ruleId: bestMatch.rule.id,
        matched: true,
        confidence: bestMatch.result.confidence,
        actionTaken: bestMatch.rule.actionType,
        llmResponse: JSON.stringify(bestMatch.result),
      });

      // Execute the action
      await this.executeAction(
        emailMessage.id,
        bestMatch.rule.actionType,
        bestMatch.rule.actionValue,
        gmailService
      );
    } else {
      console.log(`No rules matched for email ${emailMessage.id}`);
    }
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
          console.log(`Added label "${actionValue}" to email ${gmailMessageId}`);
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

        default:
          console.warn(`Unknown action type: ${actionType}`);
      }
    } catch (error) {
      console.error(`Failed to execute action ${actionType}:`, error);
      throw error;
    }
  }

  /**
   * Process all recent emails for a given email account
   */
  async processRecentEmails(
    emailAccount: EmailAccount,
    maxEmails = 10
  ): Promise<void> {
    if (!emailAccount.accessToken || !emailAccount.refreshToken) {
      throw new Error("Email account missing OAuth tokens");
    }

    const gmailService = new GmailService({
      accessToken: emailAccount.accessToken,
      refreshToken: emailAccount.refreshToken,
      expiryDate: emailAccount.tokenExpiresAt?.getTime(),
    });

    console.log(`Fetching ${maxEmails} recent emails for ${emailAccount.email}...`);
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
   * Process all email accounts for a specific user
   */
  async processUserEmails(userId: string, maxEmailsPerAccount = 10): Promise<void> {
    const emailAccounts = await db
      .select()
      .from(schema.emailAccount)
      .where(
        and(
          eq(schema.emailAccount.userId, userId),
          eq(schema.emailAccount.isActive, true)
        )
      );

    console.log(`Processing ${emailAccounts.length} email accounts for user ${userId}`);

    for (const account of emailAccounts) {
      try {
        await this.processRecentEmails(account, maxEmailsPerAccount);
      } catch (error) {
        console.error(`Failed to process account ${account.email}:`, error);
        // Continue with other accounts
      }
    }
  }
}
