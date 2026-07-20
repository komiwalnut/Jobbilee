require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const http = require('http');

const TOKEN      = process.env.DISCORD_TOKEN;
const CHANNEL_ID = '1528786568347648140';
const PORT       = process.env.PORT || 3000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

let connection = null;
let reconnectTimeout = null;

async function joinVoice() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel || !channel.isVoiceBased()) {
      console.error('Channel not found or is not a voice channel.');
      return;
    }

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId:   channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`[${new Date().toISOString()}] Joined voice channel: ${channel.name}`);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        // Discord may just be transitioning states — wait briefly before giving up
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling,  5_000),
          entersState(connection, VoiceConnectionStatus.Connecting,  5_000),
        ]);
      } catch {
        console.warn(`[${new Date().toISOString()}] Disconnected. Rejoining in 5s...`);
        connection.destroy();
        connection = null;
        reconnectTimeout = setTimeout(joinVoice, 5_000);
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      console.warn(`[${new Date().toISOString()}] Connection destroyed. Rejoining in 5s...`);
      connection = null;
      reconnectTimeout = setTimeout(joinVoice, 5_000);
    });

  } catch (err) {
    console.error('Failed to join voice channel:', err.message);
    reconnectTimeout = setTimeout(joinVoice, 10_000);
  }
}

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
  joinVoice();
});

client.on('error', (err) => console.error('Client error:', err.message));

// HTTP server — satisfies Render's web service requirement and lets UptimeRobot
// ping the bot to prevent the free-tier spin-down.
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
}).listen(PORT, () => {
  console.log(`Keep-alive server listening on port ${PORT}`);
});

if (!TOKEN) {
  console.error('DISCORD_TOKEN environment variable is not set.');
  process.exit(1);
}

client.login(TOKEN);
