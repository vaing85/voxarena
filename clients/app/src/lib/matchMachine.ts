/**
 * Pure state machine for a live PvP match. Socket/REST events are translated
 * into actions; the UI renders the resulting state. Kept side-effect-free so
 * the transitions — including reconnect/resume — are unit-testable.
 */

export type MatchResult = {
  winnerId: string;
  player1Id: string;
  player2Id: string;
  player1Score: number | null;
  player2Score: number | null;
};

export type MatchPhase =
  | "idle"
  | "queued" // in matchmaking, waiting for an opponent
  | "matched" // got a matchId, joining the room
  | "waiting" // in the room, opponent not present yet
  | "countdown" // both present, synced start scheduled (startsAt)
  | "result"; // finalized

export type MatchState = {
  phase: MatchPhase;
  matchId: string | null;
  players: string[];
  startsAt: number | null;
  opponentProgress: number;
  result: MatchResult | null;
  error: string | null;
};

export const initialMatchState: MatchState = {
  phase: "idle",
  matchId: null,
  players: [],
  startsAt: null,
  opponentProgress: 0,
  result: null,
  error: null,
};

export type MatchAction =
  | { type: "queue" }
  | { type: "matched"; matchId: string }
  | {
      type: "state";
      players: string[];
      startsAt: number | null;
      result: MatchResult | null;
    }
  | { type: "presence"; players: string[] }
  | { type: "start"; startsAt: number }
  | { type: "opponentProgress"; score: number }
  | { type: "result"; result: MatchResult }
  | { type: "error"; error: string }
  | { type: "reset" };

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case "queue":
      return { ...initialMatchState, phase: "queued" };
    case "matched":
      return { ...initialMatchState, phase: "matched", matchId: action.matchId };
    case "state":
      if (action.result) {
        return {
          ...state,
          phase: "result",
          players: action.players,
          startsAt: action.startsAt,
          result: action.result,
        };
      }
      return {
        ...state,
        phase: action.startsAt != null ? "countdown" : "waiting",
        players: action.players,
        startsAt: action.startsAt,
      };
    case "presence":
      return { ...state, players: action.players };
    case "start":
      return { ...state, phase: "countdown", startsAt: action.startsAt };
    case "opponentProgress":
      return { ...state, opponentProgress: action.score };
    case "result":
      return { ...state, phase: "result", result: action.result };
    case "error":
      return { ...state, error: action.error };
    case "reset":
      return initialMatchState;
    default:
      return state;
  }
}
