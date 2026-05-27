import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./api";

/**
 * Connect to the live-PvP namespace. Identity goes in the handshake; the
 * server reuses the REST auth path. Socket.IO handles reconnect/backoff and
 * falls back to polling when WebSocket is blocked — the connection is
 * best-effort, never the source of truth.
 */
export function connectMatchSocket(playerId: string): Socket {
  return io(API_BASE, {
    auth: { playerId },
    transports: ["websocket", "polling"],
    reconnection: true,
  });
}
