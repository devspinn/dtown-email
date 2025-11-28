import { google } from "googleapis";
import { convert } from "html-to-text";

export interface GmailCredentials {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  receivedAt: Date;
  isRead: boolean;
  isStarred: boolean;
}

export class GmailService {
  private oauth2Client;

  constructor(credentials: GmailCredentials) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.BETTER_AUTH_URL + "/api/auth/callback/google"
    );

    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate,
    });
  }

  /**
   * Fetch recent emails from Gmail
   */
  async fetchRecentEmails(maxResults = 10): Promise<EmailMessage[]> {
    const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });

    // List messages
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      q: "in:inbox", // Only inbox for now
    });

    const messages = listResponse.data.messages || [];
    const emailPromises = messages.map((msg) => this.getEmailDetails(msg.id!));

    return Promise.all(emailPromises);
  }

  /**
   * Get full details for a specific email
   */
  async getEmailDetails(messageId: string): Promise<EmailMessage> {
    const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });

    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = response.data;
    const headers = message.payload?.headers || [];

    // Extract headers
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
        ?.value || "";

    // Extract body
    let bodyHtml = "";
    let bodyText = "";

    const extractBody = (parts: any[] = []): void => {
      for (const part of parts) {
        if (part.mimeType === "text/html" && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, "base64").toString("utf-8");
        } else if (part.mimeType === "text/plain" && part.body?.data) {
          bodyText = Buffer.from(part.body.data, "base64").toString("utf-8");
        } else if (part.parts) {
          extractBody(part.parts);
        }
      }
    };

    if (message.payload?.parts) {
      extractBody(message.payload.parts);
    } else if (message.payload?.body?.data) {
      const data = Buffer.from(message.payload.body.data, "base64").toString(
        "utf-8"
      );
      if (message.payload.mimeType === "text/html") {
        bodyHtml = data;
      } else {
        bodyText = data;
      }
    }

    // If we only have HTML, convert to text for AI processing
    if (!bodyText && bodyHtml) {
      bodyText = convert(bodyHtml, {
        wordwrap: 130,
        selectors: [
          { selector: "a", options: { ignoreHref: true } },
          { selector: "img", format: "skip" },
        ],
      });
    }

    const labelIds = message.labelIds || [];
    const isRead = !labelIds.includes("UNREAD");
    const isStarred = labelIds.includes("STARRED");

    return {
      id: message.id!,
      threadId: message.threadId!,
      labelIds,
      snippet: message.snippet || "",
      from: getHeader("from"),
      to: getHeader("to"),
      subject: getHeader("subject"),
      bodyText,
      bodyHtml,
      receivedAt: new Date(parseInt(message.internalDate || "0")),
      isRead,
      isStarred,
    };
  }

  /**
   * Apply a label to an email
   */
  async addLabel(messageId: string, labelName: string): Promise<void> {
    const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });

    // First, get or create the label
    const labelId = await this.getOrCreateLabel(labelName);

    // Apply the label
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });
  }

  /**
   * Archive an email (remove INBOX label)
   */
  async archiveEmail(messageId: string): Promise<void> {
    const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });

    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: {
        removeLabelIds: ["INBOX"],
      },
    });
  }

  /**
   * Delete an email (move to trash)
   */
  async deleteEmail(messageId: string): Promise<void> {
    const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });

    await gmail.users.messages.trash({
      userId: "me",
      id: messageId,
    });
  }

  /**
   * Get or create a Gmail label
   */
  private async getOrCreateLabel(labelName: string): Promise<string> {
    const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });

    // List existing labels
    const labelsResponse = await gmail.users.labels.list({
      userId: "me",
    });

    const existingLabel = labelsResponse.data.labels?.find(
      (l) => l.name === labelName
    );

    if (existingLabel) {
      return existingLabel.id!;
    }

    // Create new label
    const createResponse = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });

    return createResponse.data.id!;
  }

  /**
   * Set up Gmail push notifications (for real-time email processing)
   * Requires Google Cloud Pub/Sub topic setup
   */
  async setupPushNotifications(topicName: string): Promise<void> {
    const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });

    await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName,
        labelIds: ["INBOX"],
      },
    });
  }
}
