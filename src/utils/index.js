import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function assert(ok, status, message) {
  if (!ok) throw new ApiError(status, message);
}
export const token = () => randomBytes(32).toString("hex");
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password) {
  assert(
    typeof password === "string" &&
      password.length >= 12 &&
      password.length <= 128,
    422,
    "Password must contain 12–128 characters",
  );
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return salt + ":" + hash.toString("hex");
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || password.length > 128) return false;
  const [salt, hex] = encoded.split(":");
  const hash = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(hash, Buffer.from(hex, "hex"));
}
export function businessClock(timezone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}
export function cents(value) {
  assert(
    typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 1e10,
    422,
    "Invalid money amount",
  );
  const n = Math.round(value * 100);
  assert(
    Math.abs(value * 100 - n) < 0.001,
    422,
    "Money supports at most two decimal places",
  );
  return n;
}
export function nextCycle(date, frequency) {
  const months = { Monthly: 1, Quarterly: 3, Yearly: 12 }[frequency];
  assert(months, 422, "Invalid frequency");
  const current = new Date(date + "T00:00:00Z");
  const target = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + months, 1),
  );
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(current.getUTCDate(), last));
  return target.toISOString().slice(0, 10);
}
export function invoiceTotals(record) {
  let subtotal = cents(record.subtotal || 0);
  if (record.items?.length)
    subtotal = record.items.reduce(
      (n, item) => n + Math.round(cents(item.unitPrice) * item.quantity),
      0,
    );
  const total = subtotal + cents(record.tax || 0) - cents(record.discount || 0);
  assert(total >= 0 && total <= 1e12, 422, "Invalid invoice total");
  return { subtotal: subtotal / 100, totalAmount: total / 100 };
}
