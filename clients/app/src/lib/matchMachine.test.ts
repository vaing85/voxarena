import { describe, it, expect } from "vitest";
import { initialMatchState, matchReducer, type MatchResult } from "./matchMachine";

const RESULT: MatchResult = {
  winnerId: "p1",
  player1Id: "p1",
  player2Id: "p2",
  player1Score: 91,
  player2Score: 80,
};

describe("matchReducer", () => {
  it("walks a full match: queue → matched → waiting → countdown → result", () => {
    let s = matchReducer(initialMatchState, { type: "queue" });
    expect(s.phase).toBe("queued");

    s = matchReducer(s, { type: "matched", matchId: "m1" });
    expect(s.phase).toBe("matched");
    expect(s.matchId).toBe("m1");

    s = matchReducer(s, { type: "state", players: ["p1"], startsAt: null, result: null });
    expect(s.phase).toBe("waiting");

    s = matchReducer(s, { type: "presence", players: ["p1", "p2"] });
    expect(s.players).toEqual(["p1", "p2"]);

    s = matchReducer(s, { type: "start", startsAt: 1000 });
    expect(s.phase).toBe("countdown");
    expect(s.startsAt).toBe(1000);
    expect(s.matchId).toBe("m1"); // preserved through transitions

    s = matchReducer(s, { type: "opponentProgress", score: 60 });
    expect(s.opponentProgress).toBe(60);

    s = matchReducer(s, { type: "result", result: RESULT });
    expect(s.phase).toBe("result");
    expect(s.result?.winnerId).toBe("p1");
  });

  it("resumes mid-round from a state snapshot (countdown)", () => {
    const s = matchReducer(
      { ...initialMatchState, phase: "matched", matchId: "m1" },
      { type: "state", players: ["p1", "p2"], startsAt: 5000, result: null }
    );
    expect(s.phase).toBe("countdown");
    expect(s.startsAt).toBe(5000);
  });

  it("resumes a finished match from a state snapshot (result)", () => {
    const s = matchReducer(
      { ...initialMatchState, phase: "matched", matchId: "m1" },
      { type: "state", players: ["p1", "p2"], startsAt: 5000, result: RESULT }
    );
    expect(s.phase).toBe("result");
    expect(s.result?.winnerId).toBe("p1");
  });

  it("reset returns to idle", () => {
    const s = matchReducer({ ...initialMatchState, phase: "result", result: RESULT }, { type: "reset" });
    expect(s).toEqual(initialMatchState);
  });
});
