import { isRecord, ValidationError } from "./validation";

const categories = { bache: "BACHE", inundacion: "INUNDACION", alumbrado: "ALUMBRADO", basura: "BASURA", arbolado: "ARBOLADO", otro: "OTRO" } as const;
export function parseBotReport(value: unknown, key: string | null) {
  if (!isRecord(value) || value.source !== "telegram") throw new ValidationError("invalid_report");
  const { external_id, category, description, address, reporter, photo, reported_at } = value;
  if ((value.expectsPhoto !== undefined && typeof value.expectsPhoto !== "boolean") ||
      (value.expectsPhoto === true && photo != null)) throw new ValidationError("invalid_report");
  if (typeof external_id !== "string" || !/^telegram:-?\d+:\d+$/.test(external_id) || external_id.length > 150 ||
      typeof category !== "string" || !Object.hasOwn(categories, category) ||
      typeof description !== "string" || description.trim().length < 10 || description.length > 2000 ||
      typeof address !== "string" || address.trim().length < 5 || address.length > 300 ||
      !isRecord(reporter) || typeof reporter.telegram_user_id !== "string" || !/^\d{1,30}$/.test(reporter.telegram_user_id) ||
      typeof reporter.telegram_chat_id !== "string" || !/^-?\d{1,30}$/.test(reporter.telegram_chat_id) ||
      external_id.split(":")[1] !== reporter.telegram_chat_id ||
      typeof reported_at !== "string" || !Number.isFinite(Date.parse(reported_at)) ||
      (photo !== null && photo !== undefined && (!isRecord(photo) || typeof photo.telegram_file_id !== "string" || !photo.telegram_file_id.trim() || photo.telegram_file_id.length > 1024))) {
    throw new ValidationError("invalid_report");
  }
  if (key !== external_id) throw new ValidationError("invalid_idempotency_key");
  return { externalId: external_id, category: categories[category as keyof typeof categories], description: description.trim(), address: address.trim(),
    telegramUserId: reporter.telegram_user_id, telegramChatId: reporter.telegram_chat_id,
    telegramFileId: isRecord(photo) ? photo.telegram_file_id as string : null, reportedAt: new Date(reported_at), source: "TELEGRAM", expectsPhoto: value.expectsPhoto === true };
}
