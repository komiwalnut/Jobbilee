# Discord Voice Bot

A Discord bot that joins and stays in a voice channel 24/7, with automatic reconnection on disconnect.

---

## Bot Setup on Discord

### 1. Create the application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → give it a name → **Create**
3. Go to the **Bot** tab → **Add Bot**
4. Under **Token**, click **Reset Token** and copy it — this is your `DISCORD_TOKEN`
5. Scroll down to **Privileged Gateway Intents** and make sure these are **OFF** (this bot doesn't need them)

### 2. Invite the bot to your server

Go to **OAuth2 → URL Generator** and configure:

**Scopes:**
- `bot`

**Bot Permissions:**
| Permission | Why |
|---|---|
| View Channel | Required to see and join the voice channel |
| Connect | Join the voice channel |

This generates a permission integer of **1049600**. Copy the generated URL at the bottom and open it in your browser to invite the bot to your server.

> Make sure the bot's role has access to the specific voice channel. You can verify this by right-clicking the channel → **Edit Channel → Permissions**.

---

## Local Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher

### Install

```bash
npm install
```

### Configure

Create a `.env` file in the project root (copy from `.env.example`):

```bash
DISCORD_TOKEN=your_bot_token_here
```

The voice channel the bot joins is hardcoded in `bot.js`:

```js
const CHANNEL_ID = '1491526270939431013';
```

Change this value if you need a different channel. To get a channel ID: in Discord, go to **Settings → Advanced → Enable Developer Mode**, then right-click the voice channel and select **Copy Channel ID**.

### Run

```bash
node bot.js
```

Expected output:
```
Keep-alive server listening on port 3000
Logged in as YourBot#1234
[2026-07-17T00:00:00.000Z] Joined voice channel: General
```

---

## Deploying

### Railway

1. Push this repo to GitHub
2. Go to [Railway](https://railway.app) → **New Project → Deploy from GitHub repo**
3. Select the repo
4. Go to **Variables** → add `DISCORD_TOKEN`
5. Railway auto-detects `npm start` — the bot will deploy automatically

Free credits: ~$5/month. A lightweight bot running 24/7 costs roughly $1–3/month.

### Render

1. Go to [Render](https://render.com) → **New → Web Service** → connect your GitHub repo
2. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
3. Add `DISCORD_TOKEN` under **Environment**
4. Deploy

**Prevent free-tier spin-down:** Render's free web services stop after 15 minutes of no HTTP traffic.

1. After deploying, copy your Render URL (e.g. `https://your-bot.onrender.com`)
2. Go to [UptimeRobot](https://uptimerobot.com) → **New Monitor**
3. Type: **HTTP(s)** | URL: your Render URL | Interval: **5 minutes**

This keeps the bot alive indefinitely within the 750 free hours/month limit.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Your bot token from the Discord Developer Portal |
| `PORT` | No | HTTP keep-alive server port (default: `3000`, auto-set by Render/Railway) |
