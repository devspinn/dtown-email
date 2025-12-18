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
  async fetchRecentEmails(maxResults = 20): Promise<EmailMessage[]> {
    console.log("Fetching recent emails from Gmail... (fetchRecentEmails)");
    const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });

    // List messages (no query filter to get all recent emails, including archived)
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      q: "category:primary OR label:cold-sales",
      // fetch all recent emails including archived ones
    });

    const messages = listResponse.data.messages || [];
    console.log(`Fetched ${messages.length} recent emails from Gmail`);
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
    console.log(`Fetched email details for message ID: ${messageId}`);
    console.log([
      message.id,
      message.labelIds,
      message.threadId,
      message.snippet,
    ]);
    console.log(
      typeof message.internalDate === "string"
        ? new Date(Number(message.internalDate)).toLocaleString()
        : "sometihng went wrong lol"
    );

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
   * Get or create a Gmail label
   */
  private async getOrCreateLabel(
    labelName: string,
    hidden?: boolean
  ): Promise<string> {
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
        labelListVisibility: hidden ? "labelHide" : "labelShow",
        messageListVisibility: hidden ? "hide" : "show",
      },
    });

    return createResponse.data.id!;
  }

  private async getSystemLabel(): Promise<string> {
    return this.getOrCreateLabel("prcsd-dtown", false);
  }

  /**
   * Apply a label and the system label to an email
   */
  async addLabel(messageId: string, labelName: string): Promise<void> {
    const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
    let labelId: string;

    // List existing labels
    const labelsResponse = await gmail.users.labels.list({
      userId: "me",
    });

    const existingLabel = labelsResponse.data.labels?.find(
      (l) => l.name === labelName
    );

    if (existingLabel) {
      labelId = existingLabel.id!;
    } else {
      // Create new label
      const createResponse = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name: labelName,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        },
      });
      labelId = createResponse.data.id!;
    }

    const systemLabel = await this.getSystemLabel();

    // Apply the label
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: {
        addLabelIds: [labelId, systemLabel],
      },
    });
  }

  /**
   * Archive an email and add system label (remove INBOX label)
   */
  async archiveEmail(messageId: string): Promise<void> {
    const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
    const systemLabel = await this.getSystemLabel();

    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: {
        removeLabelIds: ["INBOX"],
        addLabelIds: [systemLabel],
      },
    });
  }

  /**
   * Mute a thread by applying custom user-muted label and archiving
   * We use a custom label instead of Gmail's MUTED system label
   * The email processor will automatically archive future messages in this thread
   */
  async muteThread(threadId: string): Promise<void> {
    const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
    // Get or create the user-muted label
    const userMutedLabelId = await this.getOrCreateLabel("user-muted");
    const systemLabel = await this.getSystemLabel();

    // Apply the user-muted label and remove INBOX at thread level
    await gmail.users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: {
        addLabelIds: [userMutedLabelId, systemLabel],
        removeLabelIds: ["INBOX"],
      },
    });
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
