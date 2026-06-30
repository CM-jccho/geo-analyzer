// 운영자 실시간 알림 — Telegram / Slack (env 설정 시에만 발송, 없으면 no-op).
// 절대 요청 흐름을 막거나 실패시키지 않는다(fire-and-forget, 오류는 로깅만).

export async function notify(text: string): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    tasks.push(
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      }).catch((e) => console.error("[notify:telegram]", e?.message ?? e)),
    );
  }

  const slack = process.env.SLACK_WEBHOOK_URL;
  if (slack) {
    tasks.push(
      fetch(slack, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch((e) => console.error("[notify:slack]", e?.message ?? e)),
    );
  }

  await Promise.allSettled(tasks);
}
