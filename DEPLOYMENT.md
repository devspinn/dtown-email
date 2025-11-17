# Cloudflare Deployment Guide

## Prerequisites

1. Install Wrangler CLI (already in devDependencies, but you can also install globally):

   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

## Step 1: Deploy the API (Cloudflare Worker)

### 1.1 Deploy the Worker

```bash
cd packages/api
pnpm run deploy
```

This will:

- Build your API
- Deploy to Cloudflare Workers
- Give you a URL like: `https://yieldplat-api.devonstownsend.workers.dev`

### 1.2 Set Environment Variables

Set your secrets (these are encrypted):

```bash
# Database URL
wrangler secret put DATABASE_URL
# Paste your Neon Postgres URL when prompted

# Better Auth Secret
wrangler secret put BETTER_AUTH_SECRET
# Paste: <secret>

# Google OAuth (if using)
wrangler secret put GOOGLE_CLIENT_ID
# Paste: <secret>

wrangler secret put GOOGLE_CLIENT_SECRET
# Paste: <secret>
```

### 1.3 Update Worker URL in Code

After deploying, copy your Worker URL and update these files:

**apps/web/src/lib/trpc.ts** (line 12):

```typescript
return "https://yieldplat-api.YOUR_ACTUAL_SUBDOMAIN.workers.dev/trpc";
```

**apps/web/src/lib/auth-client.ts** (line 7):

```typescript
return "https://yieldplat-api.YOUR_ACTUAL_SUBDOMAIN.workers.dev";
```

**packages/api/wrangler.toml** (line 14):
Update the BETTER_AUTH_URL to your Pages URL (you'll get this in Step 2)

## Step 2: Deploy the Web App (Cloudflare Pages)

### 2.1 Create Cloudflare Pages Project

Option A: Via Dashboard (Recommended for first time)

1. Go to https://dash.cloudflare.com/
2. Select "Workers & Pages"
3. Click "Create Application" → "Pages" → "Connect to Git"
4. Connect your GitHub repo
5. Set build settings:
   - Build command: `pnpm install && pnpm --filter @yieldplat/web run build`
   - Build output directory: `apps/web/dist`
   - Root directory: `/` (leave as default)

Option B: Via CLI

```bash
cd apps/web
pnpm run build
wrangler pages deploy dist --project-name yieldplat
```

### 2.2 Update Better Auth URLs

After deployment, you'll get a URL like: `https://yieldplat.pages.dev`

Update **packages/auth/src/index.ts** (line 9):

```typescript
baseURL: process.env.BETTER_AUTH_URL || "https://yieldplat.pages.dev",
```

Update **packages/api/wrangler.toml** (line 14):

```
BETTER_AUTH_URL = "https://yieldplat.pages.dev"
```

Then redeploy the API:

```bash
cd packages/api
pnpm run deploy
```

### 2.3 Update Google OAuth Redirect URIs

Go to https://console.cloud.google.com/apis/credentials

Add these authorized redirect URIs:

- Production: `https://yieldplat-api.devonstownsend.workers.dev/api/auth/callback/google`
- Development: `http://localhost:3000/api/auth/callback/google` (keep this)

## Step 3: Test Your Deployment

1. Visit your Pages URL: `https://yieldplat.pages.dev`
2. Try signing up with email/password
3. Try signing in with Google
4. Check that the dashboard loads

## Troubleshooting

### CORS Errors

- Make sure BETTER_AUTH_URL in the Worker matches your Pages URL
- Check that credentials are being sent in the tRPC client

### Database Connection Errors

- Verify DATABASE_URL is set correctly: `wrangler secret list`
- Neon Postgres should work with Workers (serverless websockets)

### OAuth Not Working

- Double-check redirect URIs in Google Console
- Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set
- Check that baseURL in Better Auth matches your Worker URL

## Future: Custom Domain

Once you have a custom domain:

1. Add it to Cloudflare Pages
2. Update all URLs to use your domain:
   - `https://api.yourdomain.com` for the Worker
   - `https://yourdomain.com` for the Pages app
3. Update Google OAuth redirect URIs
4. Update environment variables

## Local Development

Local dev still works the same:

```bash
# Terminal 1
pnpm --filter @yieldplat/api run dev

# Terminal 2
pnpm --filter @yieldplat/web run dev
```

The Vite proxy handles routing `/api/*` to `localhost:3002` in development.
