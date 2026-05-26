/**
 * In-process bus for realtime match results. The ranked-finalization path
 * (REST) publishes here; the Socket.IO layer subscribes and pushes results to
 * the live match room. This keeps scoring/finalization free of any socket
 * dependency. Single-process only — multi-instance would need a Redis adapter.
 */
import { EventEmitter } from "node:events";

export type MatchFinalized = {
  matchId: string;
  songId: string;
  winnerId: string;
  player1Id: string;
  player2Id: string;
  player1Score: number;
  player2Score: number;
  mmr: {
    player1Id: string;
    player2Id: string;
    newMmr1: number;
    newMmr2: number;
  };
};

export const matchBus = new EventEmitter();

export function publishMatchFinalized(event: MatchFinalized): void {
  matchBus.emit("finalized", event);
}
