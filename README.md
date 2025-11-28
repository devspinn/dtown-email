# AI-Powered Email Processor

An intelligent email filtering system that uses Claude AI to process emails based on natural language rules. Define rules like "if it looks like a cold sales email, archive it" and let AI handle the classification.

## Features

- **AI-Powered Rules**: Write filtering rules in plain English (e.g., "Cold sales emails", "Newsletters I don't read")
- **Gmail Integration**: Full Gmail API support for reading and managing emails
- **Claude AI Classification**: Uses Anthropic's Claude 3.5 Haiku for fast, accurate email classification
- **Action Execution**: Automatically archive, label, or delete emails based on rule matches
- **Audit Trail**: Track all processed emails and rule matches with confidence scores
- **Type-Safe API**: Built with tRPC for end-to-end type safety

## Tech Stack

- **Backend**: Hono + tRPC + Node.js
- **Database**: Neon (Postgres) + Drizzle ORM
- **Auth**: Better Auth with Google OAuth
- **AI**: Anthropic Claude 3.5 Haiku
- **Email**: Gmail API (googleapis)
- **Monorepo**: Turborepo + pnpm

## Architecture

```
┌──────────────┐
│ Gmail Inbox  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Gmail API Sync       │ ← Fetches emails via IMAP/API
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Email Processor      │ ← Coordinates processing
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Claude AI Classifier │ ← Evaluates against rules
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Action Executor      │ ← Archives/Labels/Deletes
└──────────────────────┘
```

## Setup

### 1. Prerequisites

- Node.js 18+
- pnpm 9+
- Neon Postgres database
- Anthropic API key
- Google Cloud OAuth credentials

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required environment variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Better Auth
BETTER_AUTH_SECRET=<generate-random-string>
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth (for Gmail access)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Anthropic API
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

### 4. Set Up Google OAuth for Gmail

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Gmail API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. **Configure OAuth scopes**:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Add these scopes:
     - `https://www.googleapis.com/auth/gmail.readonly` (Read emails)
     - `https://www.googleapis.com/auth/gmail.modify` (Modify labels, archive)
     - `https://www.googleapis.com/auth/gmail.labels` (Manage labels)
6. Copy the Client ID and Client Secret to your `.env` file

### 5. Get Anthropic API Key

1. Sign up at [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Add it to your `.env` as `ANTHROPIC_API_KEY`

### 6. Push Database Schema

```bash
pnpm db:push
```

### 7. Start Development Servers

```bash
pnpm dev
```

This starts:

- API server on `http://localhost:3002`
- Web app on `http://localhost:3000`

## Usage

### Creating a Rule

Use the tRPC API to create filtering rules:

```typescript
// Example: Create a rule to filter cold sales emails
await trpc.rules.create.mutate({
  userId: "user_123",
  name: "Cold Sales Filter",
  description: "Detect and archive cold sales emails",
  systemPrompt:
    "Is this email an unsolicited sales outreach (cold email) trying to sell a product or service? Consider indicators like: mentions of products/services, asks for meetings, sender from sales role, marketing language.",
  actionType: "ARCHIVE_AND_LABEL",
  actionValue: "Cold Sales",
  priority: 0,
});
```

Or use the AI to generate the system prompt:

```typescript
const result = await trpc.rules.generatePrompt.mutate({
  description: "Cold sales emails from people I don't know",
});
// result.systemPrompt contains the AI-generated prompt
```

### Processing Emails

Manually trigger email processing:

```typescript
await trpc.emails.processNow.mutate({
  userId: "user_123",
  maxEmailsPerAccount: 10,
});
```

This will:

1. Fetch recent emails from Gmail
2. Classify each email against active rules
3. Execute actions (archive, label, delete) for matches
4. Log results to the `processed_email` table

### Viewing Results

Check processed emails:

```typescript
const processed = await trpc.processed.list.query({
  userId: "user_123",
  limit: 100,
});
```

## Database Schema

### `email_account`

Stores connected Gmail accounts with OAuth tokens.

### `rule`

User-defined filtering rules with AI prompts and actions.

### `email`

Cached emails from Gmail for fast access.

### `processed_email`

Audit trail of rule executions with confidence scores.

## API Routes (tRPC)

### Email Accounts

- `emailAccounts.list` - List connected accounts
- `emailAccounts.create` - Connect new Gmail account
- `emailAccounts.delete` - Remove account

### Rules

- `rules.list` - List all rules for user
- `rules.create` - Create new filtering rule
- `rules.update` - Update existing rule
- `rules.delete` - Delete rule
- `rules.generatePrompt` - AI-generate system prompt from description

### Emails

- `emails.list` - List cached emails
- `emails.processNow` - Manually trigger processing

### Processed

- `processed.list` - View audit trail of processed emails

## Cost Optimization

Claude 3.5 Haiku pricing (as of 2025):

- ~$0.001 per 1000 input tokens
- Processing 100 emails/day ≈ $0.50-2/month

**Tips to reduce costs:**

1. Use simple regex pre-filters before AI classification
2. Batch similar emails together
3. Cache classification results for duplicate emails
4. Only process unread emails

## Future Enhancements

- [ ] Real-time processing via Gmail Push Notifications (Pub/Sub)
- [ ] Web UI for rule management
- [ ] Rule testing/preview mode
- [ ] Multiple action support (apply multiple actions per rule)
- [ ] Rule conditions (AND/OR logic)
- [ ] Scheduled batch processing
- [ ] Email analytics dashboard
- [ ] Multi-provider support (Outlook, iCloud)

## Development

### Database Commands

```bash
# Generate migration
pnpm db:generate

# Push schema to database
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

### Build

```bash
pnpm build
```

### Lint

```bash
pnpm lint
```

## Project Structure

```
├── apps/
│   └── web/              # React frontend (future)
├── packages/
│   ├── api/              # Hono + tRPC API
│   │   └── src/
│   │       ├── services/
│   │       │   ├── gmail.ts       # Gmail API integration
│   │       │   ├── ai.ts          # Claude AI service
│   │       │   └── processor.ts   # Email processing logic
│   │       ├── router.ts          # tRPC routes
│   │       └── server.ts          # Hono server
│   ├── db/               # Drizzle schema + migrations
│   ├── auth/             # Better Auth config
│   └── ui/               # Shared UI components
```

## Security Notes

- OAuth tokens are stored in plain text in the database. **In production, encrypt these fields**.
- Email bodies are sent to Anthropic's API. Review their [privacy policy](https://www.anthropic.com/legal/privacy).
- Consider using local LLMs (Ollama) for sensitive emails.

## License

MIT
