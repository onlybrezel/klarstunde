export class TelegramError extends Error {}

export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4096),
      disable_web_page_preview: true,
      protect_content: true,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new TelegramError(`Telegram antwortete mit Status ${response.status}.`)
}
