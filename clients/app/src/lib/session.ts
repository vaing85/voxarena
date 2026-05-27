/** Local identity + active-match persistence (survives reloads / reconnects). */

const PLAYER_KEY = "vox.playerId";
const MATCH_KEY = "vox.activeMatchId";

export function getPlayerId(): string | null {
  return localStorage.getItem(PLAYER_KEY);
}

export function setPlayerId(id: string): void {
  localStorage.setItem(PLAYER_KEY, id);
}

export function clearPlayerId(): void {
  localStorage.removeItem(PLAYER_KEY);
}

/**
 * The match the player is currently in. Persisted so a reload or dropped
 * connection can re-join and resume (the server replays `match:state`).
 */
export function getActiveMatchId(): string | null {
  return localStorage.getItem(MATCH_KEY);
}

export function setActiveMatchId(id: string | null): void {
  if (id) localStorage.setItem(MATCH_KEY, id);
  else localStorage.removeItem(MATCH_KEY);
}
