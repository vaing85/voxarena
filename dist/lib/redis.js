"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
exports.redisPing = redisPing;
const ioredis_1 = __importDefault(require("ioredis"));
let client = null;
function getRedis() {
    if (client)
        return client;
    const url = process.env.REDIS_URL;
    if (!url || url === "") {
        return null;
    }
    client = new ioredis_1.default(url, {
        maxRetriesPerRequest: 2,
        lazyConnect: true,
    });
    return client;
}
async function redisPing() {
    const r = getRedis();
    if (!r) {
        return { ok: false, error: "REDIS_URL not set" };
    }
    try {
        const pong = await r.ping();
        return { ok: pong === "PONG" };
    }
    catch (e) {
        return { ok: false, error: String(e) };
    }
}
