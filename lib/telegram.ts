const username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "reportAr_test_bot";
export const telegramBotUrl = `https://t.me/${encodeURIComponent(username.replace(/^@/, ""))}`;
