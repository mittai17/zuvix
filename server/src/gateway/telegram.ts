import TelegramBot from 'node-telegram-bot-api';
import { memoryEngine } from '../memory/vector';

let bot: TelegramBot | null = null;

export interface GatewayMessage {
  platform: 'telegram' | 'mock';
  chatId: number | string;
  channelId?: string;
  text: string;
  from: string;
  timestamp: number;
}

type MessageHandler = (msg: GatewayMessage) => void;
let messageHandler: MessageHandler | null = null;

export function setMessageHandler(handler: MessageHandler) {
  messageHandler = handler;
}

export function initTelegramBot(token: string, fallbackHandler: MessageHandler) {
  if (!messageHandler) messageHandler = fallbackHandler;

  if (!token || token === 'mock' || token === '') {
    console.log('[Telegram] No valid token — starting mock bot');
    startMockBot();
    return;
  }

  try {
    bot = new TelegramBot(token, { polling: true });
    console.log('[Telegram] Bot connected and polling');

    bot.on('message', async (msg) => {
      if (!msg.text || !msg.chat) return;
      const gatewayMsg: GatewayMessage = {
        platform: 'telegram',
        chatId: msg.chat.id,
        text: msg.text,
        from: msg.from?.username || msg.from?.first_name || 'unknown',
        timestamp: Date.now(),
      };

      // Store in memory
      await memoryEngine.saveMemory(`telegram:${msg.chat.id}`, `[${gatewayMsg.from}] ${msg.text}`);

      // Route to handler
      if (messageHandler) messageHandler(gatewayMsg);
    });

    bot.on('polling_error', (err) => {
      console.error('[Telegram] Polling error:', err.message);
    });
  } catch (err: any) {
    console.error('[Telegram] Failed to start bot:', err.message);
    console.log('[Telegram] Falling back to mock bot');
    startMockBot();
  }
}

export function sendTelegramMessage(chatId: number, text: string) {
  if (bot) {
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(err => {
      console.error('[Telegram] Send error:', err.message);
    });
  }
}

export function isBotRunning(): boolean {
  return bot !== null;
}

function startMockBot() {
  console.log('[Telegram] Mock bot active — simulating messages every 30s');
  setInterval(() => {
    if (messageHandler) {
      messageHandler({
        platform: 'mock',
        chatId: 'mock-chat',
        text: 'ping from mock telegram',
        from: 'mock-user',
        timestamp: Date.now(),
      });
    }
  }, 30000);
}
