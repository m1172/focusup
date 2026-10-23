import process from 'node:process';

// Explicit setup command for the support chat bot; the API never changes the webhook itself.
//  1. Without TELEGRAM_SUPPORT_CHAT_ID: lists the chats that recently messaged the bot, so you can copy the team chat's id.
//  2. With it: points the bot's webhook at the deployed Edge API, protected by TELEGRAM_WEBHOOK_SECRET.
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_SUPPORT_CHAT_ID;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const missing = [['TELEGRAM_BOT_TOKEN', token], ['SUPABASE_URL', supabaseUrl]].filter(([, value]) => !value).map(([name]) => name);
if (missing.length) {
  console.error(`Missing in backend/.env: ${missing.join(', ')}. Get a bot token from @BotFather (/newbot) and paste it after TELEGRAM_BOT_TOKEN=.`);
  process.exit(1);
}

async function telegram(method: string, body: unknown = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  const decoded = await response.json() as { ok: boolean; result?: unknown; description?: string };
  // Telegram's description never contains the token, unlike the request URL.
  if (!decoded.ok) throw new Error(`Telegram ${method} failed: ${decoded.description ?? response.status}`);
  return decoded.result;
}

try {
  if (!chatId) {
    // getUpdates only works while no webhook is set.
    await telegram('deleteWebhook');
    const updates = await telegram('getUpdates', { allowed_updates: ['message'] }) as { message?: { chat: { id: number; type: string; title?: string; first_name?: string } } }[];
    const chats = new Map(updates.flatMap((update) => update.message ? [[update.message.chat.id, update.message.chat]] : []));
    if (!chats.size) console.log('No messages yet. Add the bot to your support group and send /start there (bots in groups only see commands), then run this again.');
    for (const chat of chats.values()) console.log(`${chat.id}\t${chat.type}\t${chat.title ?? chat.first_name ?? ''}`);
    if (chats.size) console.log('\nPut the right id in TELEGRAM_SUPPORT_CHAT_ID (backend/.env and the Supabase function secrets), then run this again.');
  } else {
    if (!secret || !/^[A-Za-z0-9_-]{24,256}$/.test(secret)) throw new Error('Set TELEGRAM_WEBHOOK_SECRET to 24+ random letters, digits, _ or -.');
    const url = new URL('/functions/v1/focusup-api/v1/support/telegram', supabaseUrl).toString();
    await telegram('setWebhook', { url, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true });
    await telegram('sendMessage', { chat_id: chatId, text: '✅ FocusUp support chat is connected. Messages from the app will appear here — reply to one to answer.' });
    console.log(`Webhook set to ${url}. A test message was sent to the support chat.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Support bot setup failed.');
  process.exitCode = 1;
}
