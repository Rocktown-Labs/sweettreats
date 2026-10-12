import { Resend } from "resend";

let cachedClient: Resend | null = null;
let lastApiKey: string | null = null;

export function getResendClient(apiKey?: string): Resend | null {
  const key =
    apiKey || (typeof process !== "undefined" ? process.env?.RESEND_API_KEY : undefined) || "";

  if (!key) {
    return null;
  }

  if (cachedClient && lastApiKey === key) {
    return cachedClient;
  }

  cachedClient = new Resend(key);
  lastApiKey = key;
  return cachedClient;
}
