require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const http = require('http');
const fs   = require('fs');
const path = require('path');

const TOKEN      = process.env.DISCORD_TOKEN;
const CHANNEL_ID = '1529609152400326686';
const PORT       = process.env.PORT || 3000;

if (!TOKEN) {
  console.error('DISCORD_TOKEN environment variable is not set.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Load slash commands from ./commands/
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsPath, file));
  client.commands.set(cmd.data.name, cmd);
}

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

    connection.on('error', err => {
      console.error(`[${new Date().toISOString()}] Voice connection error:`, err.message);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
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

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register slash commands globally (propagates within ~1 hour)
  try {
    const rest = new REST().setToken(TOKEN);
    const commands = [...client.commands.values()].map(cmd => cmd.data.toJSON());
    await rest.put(Routes.applicationCommands(client.application.id), { body: commands });
    console.log(`Registered ${commands.length} slash command(s).`);
  } catch (err) {
    console.error('Failed to register slash commands:', err.message);
  }

  joinVoice();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(`Error in /${interaction.commandName}:`, err.message);
    const msg = { content: 'Something went wrong running that command.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

client.on('error', err => console.error('Client error:', err.message));
client.on('shardError', err => console.error('Shard error:', err.message));

process.on('unhandledRejection', err => {
  console.error('Unhandled rejection:', err);
});

function shutdown() {
  console.log(`[${new Date().toISOString()}] Shutting down, leaving voice channel...`);
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (connection) {
    connection.destroy();
    connection = null;
  }
  client.destroy();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// HTTP server — satisfies Render's web service requirement and lets UptimeRobot
// ping the bot to prevent the free-tier spin-down.
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
}).listen(PORT, () => {
  console.log(`Keep-alive server listening on port ${PORT}`);
});

client.login(TOKEN).catch(err => {
  console.error('Failed to log in to Discord:', err.message);
});
