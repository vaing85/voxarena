import type Redis from "ioredis";
import { getRedis } from "./redis.js";

const PREFIX = "voxarena:ranked:queue:";
const PLAYER_KEY = "voxarena:ranked:playerSong:";

/** Atomic join + pair if ≥2 waiting (same song). Returns paired player ids + payloads or null. */
const JOIN_LUA = `
local hkey = KEYS[1]
local pid = ARGV[1]
local data = ARGV[2]
redis.call('HSET', hkey, pid, data)
local n = redis.call('HLEN', hkey)
if n >= 2 then
  local flat = redis.call('HGETALL', hkey)
  local p1 = flat[1]
  local v1 = flat[2]
  local p2 = flat[3]
  local v2 = flat[4]
  redis.call('HDEL', hkey, p1, p2)
  return {p1, v1, p2, v2}
end
return false
`;

export type QueuePayload = { mmr: number; ts: number };

export async function rankedJoin(
  redis: Redis,
  songId: string,
  playerId: string,
  payload: QueuePayload
): Promise<
  | { matched: false }
  | {
      matched: true;
      player1Id: string;
      player2Id: string;
      payload1: QueuePayload;
      payload2: QueuePayload;
    }
> {
  const hkey = `${PREFIX}${songId}`;
  const raw = await redis.eval(
    JOIN_LUA,
    1,
    hkey,
    playerId,
    JSON.stringify(payload)
  );

  if (!raw || raw === false) {
    await redis.set(`${PLAYER_KEY}${playerId}`, songId, "EX", 3600);
    return { matched: false };
  }

  const arr = raw as string[];
  if (!Array.isArray(arr) || arr.length < 4) {
    return { matched: false };
  }

  const p1 = arr[0] as string;
  const v1 = JSON.parse(arr[1] as string) as QueuePayload;
  const p2 = arr[2] as string;
  const v2 = JSON.parse(arr[3] as string) as QueuePayload;

  return {
    matched: true,
    player1Id: p1,
    player2Id: p2,
    payload1: v1,
    payload2: v2,
  };
}

export async function rankedLeave(
  redis: Redis,
  songId: string,
  playerId: string
): Promise<void> {
  const hkey = `${PREFIX}${songId}`;
  await redis.hdel(hkey, playerId);
  await redis.del(`${PLAYER_KEY}${playerId}`);
}

export async function getPlayerQueuedSong(
  redis: Redis,
  playerId: string
): Promise<string | null> {
  return redis.get(`${PLAYER_KEY}${playerId}`);
}

export async function clearPlayerQueueMarker(
  redis: Redis,
  playerId: string
): Promise<void> {
  await redis.del(`${PLAYER_KEY}${playerId}`);
}

const PENDING_PREFIX = "voxarena:pending:";

export async function setPendingMatch(
  redis: Redis,
  playerId: string,
  matchId: string
): Promise<void> {
  await redis.set(`${PENDING_PREFIX}${playerId}`, matchId, "EX", 86400);
}

export async function getPendingMatch(
  redis: Redis,
  playerId: string
): Promise<string | null> {
  return redis.get(`${PENDING_PREFIX}${playerId}`);
}

export function getMatchmakingRedis(): Redis | null {
  return getRedis();
}
