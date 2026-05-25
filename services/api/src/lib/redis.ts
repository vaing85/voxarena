import Redis from "ioredis";

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url || url === "") {
    return null;
  }
  client = new Redis(url, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });
  return client;
}

export async function redisPing(): Promise<{ ok: boolean; error?: string }> {
  const r = getRedis();
  if (!r) {
    return { ok: false, error: "REDIS_URL not set" };
  }
  try {
    const pong = await r.ping();
    return { ok: pong === "PONG" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
