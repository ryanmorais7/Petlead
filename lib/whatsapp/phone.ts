/** Phone numbers are stored with country code and digits only (E.164 without "+"). */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

const BRAZIL = "55";

/**
 * Every spelling under which the same WhatsApp account may appear.
 *
 * Brazilian mobile numbers gained a ninth digit, but WhatsApp still identifies
 * many accounts without it. A lead typed as 55 11 98888-7777 can write to us
 * as 55 11 8888-7777, and both must resolve to the same lead.
 */
export function phoneVariants(raw: string): string[] {
  const phone = normalizePhone(raw);
  if (!phone.startsWith(BRAZIL)) return [phone];

  const area = phone.slice(2, 4);
  const local = phone.slice(4);

  if (local.length === 9 && local.startsWith("9")) {
    return [phone, `${BRAZIL}${area}${local.slice(1)}`];
  }
  // Landlines start with 2-5 and never had the extra digit.
  if (local.length === 8 && /^[6-9]/.test(local)) {
    return [phone, `${BRAZIL}${area}9${local}`];
  }
  return [phone];
}
