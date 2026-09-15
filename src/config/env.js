export function configuration(env = process.env) {
  const production = env.NODE_ENV === "production";
  const origins = (env.APP_ORIGINS || "http://localhost:4200")
    .split(",")
    .map((x) => new URL(x.trim()).origin);
  if (production && origins.some((x) => !x.startsWith("https://")))
    throw new Error("Production APP_ORIGINS must use HTTPS");
  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  const timezone = env.BUSINESS_TIMEZONE || "Asia/Kolkata";
  new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  return {
    production,
    origins,
    port,
    timezone,
    mongoUri: env.MONGODB_URI,
    trustProxy: env.TRUST_PROXY || false,
    sessionHours: 12,
  };
}
