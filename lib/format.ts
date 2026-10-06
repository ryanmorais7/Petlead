/** Display helpers. Every date is rendered in the seller's time zone. */

export const APP_TIME_ZONE = "America/Sao_Paulo";
const LOCALE = "pt-BR";
const DAY_MS = 24 * 60 * 60 * 1000;

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const shortDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
});
const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "long",
  year: "numeric",
});
const weekdayFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: APP_TIME_ZONE,
  weekday: "long",
  day: "2-digit",
  month: "long",
});
const currencyFormatter = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "BRL" });

/** Calendar day (YYYY-MM-DD) of a date in the app time zone. */
export function dayKey(date: Date): string {
  return dayKeyFormatter.format(date);
}

/** Whole calendar days between two dates, in the app time zone. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const start = Date.parse(`${dayKey(from)}T00:00:00Z`);
  const end = Date.parse(`${dayKey(to)}T00:00:00Z`);
  return Math.round((end - start) / DAY_MS);
}

export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

export function formatShortDate(date: Date): string {
  return shortDateFormatter.format(date).replace(".", "");
}

export function formatLongDate(date: Date): string {
  return longDateFormatter.format(date);
}

export function formatWeekday(date: Date): string {
  const text = weekdayFormatter.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDateTime(date: Date): string {
  return `${formatShortDate(date)}, ${formatTime(date)}`;
}

/** "hoje", "ontem", "há 3 dias", "amanhã", "em 4 dias". */
export function formatRelativeDay(date: Date, now: Date): string {
  const days = calendarDaysBetween(date, now);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days === -1) return "amanhã";
  if (days > 1) return `há ${days} dias`;
  return `em ${Math.abs(days)} dias`;
}

/** Compact label for conversation lists: time today, "ontem", then the date. */
export function formatListTimestamp(date: Date, now: Date): string {
  const days = calendarDaysBetween(date, now);
  if (days === 0) return formatTime(date);
  if (days === 1) return "ontem";
  return formatShortDate(date);
}

/** Day separator used inside a message thread. */
export function formatThreadDay(date: Date, now: Date): string {
  const days = calendarDaysBetween(date, now);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return formatLongDate(date);
}

export function formatCurrency(value: number | string): string {
  return currencyFormatter.format(typeof value === "string" ? Number(value) : value);
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}%`;
}

/** 5511988887777 -> (11) 98888-7777. Unknown shapes are returned untouched. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return phone;
}

/** Opens the conversation in the official WhatsApp app, optionally with a draft. */
export function whatsappLink(phone: string, text?: string): string {
  const base = `https://wa.me/${phone.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function formatPets(petCount: number | null, petNames: readonly string[]): string {
  if (petCount === null) return "Pets não informados";
  if (petCount === 0) return "Sem pets informados";
  const count = petCount === 1 ? "1 pet" : `${petCount} pets`;
  return petNames.length > 0 ? `${count} · ${petNames.join(", ")}` : count;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
