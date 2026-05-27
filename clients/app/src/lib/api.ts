/** Typed client for the VoxArena REST API. */

export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";

export type Player = {
  id: string;
  name: string | null;
  email: string | null;
  mmr: number;
  tier: string;
  createdAt: string;
};

export type Song = {
  id: string;
  title: string;
  artist: string | null;
  difficulty: string;
  referenceId: string | null;
  createdAt: string;
};

export type Performance = {
  id: string;
  playerId: string;
  songId: string;
  mode: string;
  matchId: string | null;
  scorePitch: number | null;
  scoreTiming: number | null;
  scoreStability: number | null;
  scoreDynamics: number | null;
  scoreTransitions: number | null;
  scoreTotal: number | null;
  createdAt: string;
};

export type AudioScore = {
  performance: Performance;
  ranked: unknown | null;
  pitch: { scorePitch: number; meanCentsError: number | null };
  timing: { scoreTiming: number | null };
  stability: { scoreStability: number | null };
  dynamics: { scoreDynamics: number | null };
  transitions: { scoreTransitions: number | null };
};

export type LeaderboardEntry = Performance & {
  rank: number;
  player?: { id: string; name: string | null };
};

export type RankedJoin = {
  status: "queued" | "matched";
  songId: string;
  matchId?: string;
  player1Id?: string;
  player2Id?: string;
};

export type Pack = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  songCount: number;
  purchasable: boolean;
  owned: boolean;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function authHeaders(playerId: string | null): Record<string, string> {
  return playerId ? { "x-player-id": playerId } : {};
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

async function get<T>(path: string, playerId: string | null = null): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders(playerId) });
  return parse<T>(res);
}

async function postJson<T>(path: string, body: unknown, playerId: string | null): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(playerId) },
    body: JSON.stringify(body),
  });
  return parse<T>(res);
}

export const api = {
  createPlayer: (name: string | null, playerId: string | null) =>
    postJson<Player>("/players", name ? { name } : {}, playerId),

  listSongs: () => get<{ songs: Song[] }>("/songs").then((r) => r.songs),

  leaderboard: (songId: string, limit = 20) =>
    get<{ leaderboard: LeaderboardEntry[] }>(
      `/leaderboard?songId=${encodeURIComponent(songId)}&limit=${limit}`
    ).then((r) => r.leaderboard),

  listPacks: (playerId: string | null) =>
    get<{ packs: Pack[] }>("/store/packs", playerId).then((r) => r.packs),

  joinRanked: (playerId: string, songId: string) =>
    postJson<RankedJoin>("/matchmaking/ranked/join", { playerId, songId }, playerId),

  leaveRanked: (playerId: string) =>
    postJson<{ left: boolean }>("/matchmaking/ranked/leave", { playerId }, playerId),

  pendingMatch: (playerId: string) =>
    get<{ playerId: string; matchId: string | null }>(
      `/matchmaking/ranked/pending/${playerId}`,
      playerId
    ),

  /** Submit recorded audio for real server-side scoring. */
  async scoreAudio(
    playerId: string,
    songId: string,
    mode: string,
    audio: Blob,
    matchId?: string
  ): Promise<AudioScore> {
    const form = new FormData();
    form.append("audio", audio, "take.wav");
    form.append("playerId", playerId);
    form.append("songId", songId);
    form.append("mode", mode);
    if (matchId) form.append("matchId", matchId);
    // No Content-Type header — the browser sets the multipart boundary.
    const res = await fetch(`${API_BASE}/performances/audio`, {
      method: "POST",
      headers: authHeaders(playerId),
      body: form,
    });
    return parse<AudioScore>(res);
  },
};
