"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankedJoin = rankedJoin;
exports.rankedLeave = rankedLeave;
exports.getPlayerQueuedSong = getPlayerQueuedSong;
exports.clearPlayerQueueMarker = clearPlayerQueueMarker;
exports.setPendingMatch = setPendingMatch;
exports.getPendingMatch = getPendingMatch;
exports.getMatchmakingRedis = getMatchmakingRedis;
const redis_js_1 = require("./redis.js");
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
async function rankedJoin(redis, songId, playerId, payload) {
    const hkey = `${PREFIX}${songId}`;
    const raw = await redis.eval(JOIN_LUA, 1, hkey, playerId, JSON.stringify(payload));
    if (!raw || raw === false) {
        await redis.set(`${PLAYER_KEY}${playerId}`, songId, "EX", 3600);
        return { matched: false };
    }
    const arr = raw;
    if (!Array.isArray(arr) || arr.length < 4) {
        return { matched: false };
    }
    const p1 = arr[0];
    const v1 = JSON.parse(arr[1]);
    const p2 = arr[2];
    const v2 = JSON.parse(arr[3]);
    return {
        matched: true,
        player1Id: p1,
        player2Id: p2,
        payload1: v1,
        payload2: v2,
    };
}
async function rankedLeave(redis, songId, playerId) {
    const hkey = `${PREFIX}${songId}`;
    await redis.hdel(hkey, playerId);
    await redis.del(`${PLAYER_KEY}${playerId}`);
}
async function getPlayerQueuedSong(redis, playerId) {
    return redis.get(`${PLAYER_KEY}${playerId}`);
}
async function clearPlayerQueueMarker(redis, playerId) {
    await redis.del(`${PLAYER_KEY}${playerId}`);
}
const PENDING_PREFIX = "voxarena:pending:";
async function setPendingMatch(redis, playerId, matchId) {
    await redis.set(`${PENDING_PREFIX}${playerId}`, matchId, "EX", 86400);
}
async function getPendingMatch(redis, playerId) {
    return redis.get(`${PENDING_PREFIX}${playerId}`);
}
function getMatchmakingRedis() {
    return (0, redis_js_1.getRedis)();
}
