import type Redis from "ioredis";
import { getRedis } from "./redis.js";

const PREFIX = "voxarena:ranked:queue:";
const PLAYER_KEY = "voxarena:ranked:playerSong:";

// MMR pairing window (points). A freshly-queued player matches an opponent
// within MMR_WINDOW_BASE; the allowed gap grows by MMR_WINDOW_STEP for every
// MMR_WINDOW_INTERVAL_MS a candidate has been waiting, capped at MMR_WINDOW_MAX.
const MMR_WINDOW_BASE = 100;
const MMR_WINDOW_STEP = 100;
const MMR_WINDOW_INTERVAL_MS = 10_000;
const MMR_WINDOW_MAX = 1000;

/**
 * Atomic join + MMR-aware pairing (same song). On join, picks the waiting
 * opponent with the closest MMR that falls within the (widening) window, and
 * removes both from the queue. Returns the paired ids + payloads, or false.
 * Queue entries are encoded as "mmr:ts".
 */
const JOIN_LUA = `
local hkey = KEYS[1]
local pid = ARGV[1]
local data = ARGV[2]
local mmr = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local base = tonumber(ARGV[5])
local step = tonumber(ARGV[6])
local interval = tonumber(ARGV[7])
local maxwin = tonumber(ARGV[8])

redis.call('HSET', hkey, pid, data)

local flat = redis.call('HGETALL', hkey)
local bestPid = nil
local bestData = nil
local bestDiff = -1

local i = 1
while i <= #flat do
  local cpid = flat[i]
  local cdata = flat[i + 1]
  if cpid ~= pid then
    local cmmr, cts = string.match(cdata, "^(%-?%d+):(%-?%d+)$")
    cmmr = tonumber(cmmr)
    cts = tonumber(cts)
    if cmmr ~= nil and cts ~= nil then
      local waited = now - cts
      if waited < 0 then waited = 0 end
      local win = base + step * math.floor(waited / interval)
      if win > maxwin then win = maxwin end
      local diff = math.abs(mmr - cmmr)
      if diff <= win and (bestDiff < 0 or diff < bestDiff) then
        bestDiff = diff
        bestPid = cpid
        bestData = cdata
      end
    end
  end
  i = i + 2
end

if bestPid ~= nil then
  redis.call('HDEL', hkey, pid, bestPid)
  return {pid, data, bestPid, bestData}
end
return false
`;

export type QueuePayload = { mmr: number; ts: number };

function encodePayload(p: QueuePayload): string {
  return `${Math.round(p.mmr)}:${Math.round(p.ts)}`;
}

function decodePayload(s: string): QueuePayload {
  const idx = s.indexOf(":");
  return { mmr: Number(s.slice(0, idx)), ts: Number(s.slice(idx + 1)) };
}

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
    encodePayload(payload),
    String(Math.round(payload.mmr)),
    String(Math.round(payload.ts)),
    String(MMR_WINDOW_BASE),
    String(MMR_WINDOW_STEP),
    String(MMR_WINDOW_INTERVAL_MS),
    String(MMR_WINDOW_MAX)
  );

  const arr = raw as unknown[];
  if (!Array.isArray(arr) || arr.length < 4) {
    await redis.set(`${PLAYER_KEY}${playerId}`, songId, "EX", 3600);
    return { matched: false };
  }

  return {
    matched: true,
    player1Id: arr[0] as string,
    player2Id: arr[2] as string,
    payload1: decodePayload(arr[1] as string),
    payload2: decodePayload(arr[3] as string),
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
