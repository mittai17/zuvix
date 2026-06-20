import { Client, GatewayIntentBits, Message } from 'discord.js';
import { memoryEngine } from '../memory/vector';

export interface DiscordMessage {
  platform: 'discord';
  channelId: string;
  guildId: string | null;
  text: string;
  from: string;
  fromId: string;
  timestamp: number;
}

type MessageHandler = (msg: DiscordMessage) => void;

let messageHandler: MessageHandler | null = null;
let client: Client | null = null;

export function setDiscordHandler(handler: MessageHandler) {
  messageHandler = handler;
}

export function initDiscordBot(token: string, fallbackHandler: MessageHandler) {
  if (!messageHandler) messageHandler = fallbackHandler;

  if (!token || token === 'mock' || token === '') {
    console.log('[Discord] No valid token — mock mode');
    return;
  }

  try {
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    client.once('ready', () => {
      console.log(`[Discord] Bot connected as ${client?.user?.tag}`);
    });

    client.on('messageCreate', async (msg: Message) => {
      if (msg.author.bot) return;
      if (!messageHandler) return;

      const discordMsg: DiscordMessage = {
        platform: 'discord',
        channelId: msg.channelId,
        guildId: msg.guildId,
        text: msg.content,
        from: msg.author.username,
        fromId: msg.author.id,
        timestamp: Date.now(),
      };

      await memoryEngine.saveMemory(
        `discord:${msg.channelId}`,
        `[${msg.author.username}] ${msg.content}`
      );

      messageHandler(discordMsg);

      // Auto-react to show we saw it
      if (msg.channel && 'sendTyping' in msg.channel) {
        try { await (msg.channel as any).sendTyping(); } catch {}
      }
    });

    client.login(token).catch(err => {
      console.error('[Discord] Login failed:', err.message);
    });
  } catch (err: any) {
    console.error('[Discord] Init error:', err.message);
  }
}

export function isDiscordRunning(): boolean {
  return client !== null && client.isReady();
}

export async function sendDiscordMessage(channelId: string, text: string) {
  if (!client || !client.isReady()) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel && 'send' in channel) {
      await (channel as any).send(text);
    }
  } catch (err: any) {
    console.error('[Discord] Send error:', err.message);
  }
}
