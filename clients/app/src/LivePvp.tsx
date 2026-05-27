import { useEffect, useReducer, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { api, ApiError } from "./lib/api";
import { startRecorder, type Recorder } from "./lib/audio";
import { connectMatchSocket } from "./lib/socket";
import { initialMatchState, matchReducer, type MatchResult } from "./lib/matchMachine";
import { getActiveMatchId, setActiveMatchId } from "./lib/session";

function errText(e: unknown): string {
  return e instanceof ApiError ? `${e.status}: ${e.message}` : String(e);
}

function toResult(p: any): MatchResult {
  return {
    winnerId: p.winnerId,
    player1Id: p.player1Id,
    player2Id: p.player2Id,
    player1Score: p.player1Score ?? null,
    player2Score: p.player2Score ?? null,
  };
}

export function LivePvp({ playerId, songId }: { playerId: string; songId: string }) {
  const [state, dispatch] = useReducer(matchReducer, initialMatchState);
  const [now, setNow] = useState(Date.now());
  const [recorder, setRecorder] = useState<Recorder | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<number | null>(null);
  const progRef = useRef<number | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  function teardown() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (progRef.current) window.clearInterval(progRef.current);
    pollRef.current = null;
    progRef.current = null;
    socketRef.current?.disconnect();
    socketRef.current = null;
  }

  function attach(matchId: string) {
    const socket = connectMatchSocket(playerId);
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("match:join", { matchId }));
    socket.on("match:state", (p: any) =>
      dispatch({
        type: "state",
        players: p.players ?? [],
        startsAt: p.startsAt ?? null,
        result: p.result ? toResult(p.result) : null,
      })
    );
    socket.on("match:presence", (p: any) => dispatch({ type: "presence", players: p.players ?? [] }));
    socket.on("match:start", (p: any) => dispatch({ type: "start", startsAt: p.startsAt }));
    socket.on("opponent:progress", (p: any) => dispatch({ type: "opponentProgress", score: p.score ?? 0 }));
    socket.on("match:result", (p: any) => {
      dispatch({ type: "result", result: toResult(p) });
      setActiveMatchId(null);
    });
    socket.on("match:error", (p: any) => dispatch({ type: "error", error: p.error ?? "match error" }));
  }

  function beginMatch(matchId: string) {
    setActiveMatchId(matchId);
    dispatch({ type: "matched", matchId });
    attach(matchId);
  }

  // Resume a match left in localStorage (reload / dropped connection).
  useEffect(() => {
    const active = getActiveMatchId();
    if (active) beginMatch(active);
    return teardown;
  }, []);

  async function findMatch() {
    if (!songId) return setNote("Pick a song first.");
    setNote(null);
    try {
      const res = await api.joinRanked(playerId, songId);
      if (res.status === "matched" && res.matchId) {
        beginMatch(res.matchId);
        return;
      }
      dispatch({ type: "queue" });
      pollRef.current = window.setInterval(async () => {
        try {
          const { matchId } = await api.pendingMatch(playerId);
          if (matchId) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null;
            beginMatch(matchId);
          }
        } catch {
          /* keep polling */
        }
      }, 1500);
    } catch (e) {
      setNote(errText(e));
    }
  }

  async function cancel() {
    try {
      await api.leaveRanked(playerId);
    } catch {
      /* ignore */
    }
    teardown();
    setActiveMatchId(null);
    dispatch({ type: "reset" });
    setNote(null);
  }

  async function toggleRecord() {
    if (recorder) {
      const { blob } = recorder.stop();
      setRecorder(null);
      if (progRef.current) window.clearInterval(progRef.current);
      progRef.current = null;
      socketRef.current?.emit("match:progress", { score: 100 });
      if (!state.matchId) return;
      setBusy(true);
      setNote("Submitting your take…");
      try {
        await api.scoreAudio(playerId, songId, "ranked_pvp", blob, state.matchId);
        setNote("Submitted — waiting for the result…");
      } catch (e) {
        setNote(errText(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      setRecorder(await startRecorder());
      const started = Date.now();
      progRef.current = window.setInterval(() => {
        const pct = Math.min(95, ((Date.now() - started) / 1000) * 20);
        socketRef.current?.emit("match:progress", { score: Math.round(pct) });
      }, 500);
    } catch (e) {
      setNote(`Mic access failed: ${errText(e)}`);
    }
  }

  const secondsLeft =
    state.startsAt != null ? Math.max(0, Math.ceil((state.startsAt - now) / 1000)) : null;
  const canRecord = state.phase === "countdown" && secondsLeft === 0;
  const won = state.result ? state.result.winnerId === playerId : false;

  return (
    <section className="panel">
      <h2>Live PvP (ranked)</h2>

      {state.error && <div className="msg err">{state.error}</div>}
      {note && <div className="msg ok">{note}</div>}

      {state.phase === "idle" && (
        <>
          <p className="who">Find a live ranked opponent on the selected song.</p>
          <button onClick={findMatch}>Find ranked match</button>
        </>
      )}

      {state.phase === "queued" && (
        <>
          <p className="who">Searching for an opponent…</p>
          <button className="secondary" onClick={cancel}>Cancel</button>
        </>
      )}

      {(state.phase === "matched" || state.phase === "waiting") && (
        <>
          <p className="who">
            Matched. Opponent {state.players.length >= 2 ? "connected" : "connecting…"}{" "}
            ({state.players.length}/2)
          </p>
          <button className="secondary" onClick={cancel}>Leave</button>
        </>
      )}

      {state.phase === "countdown" && (
        <>
          {secondsLeft! > 0 ? (
            <p className="total">Starts in {secondsLeft}</p>
          ) : (
            <button
              className={recorder ? "recording" : ""}
              onClick={toggleRecord}
              disabled={busy || !canRecord}
            >
              {recorder ? "⏹ Stop & submit" : "🎤 Sing now"}
            </button>
          )}
          <div className="bar" style={{ marginTop: 12 }}>
            <span>Opponent</span>
            <span className="track">
              <span className="fill" style={{ width: `${state.opponentProgress}%` }} />
            </span>
            <span>{state.opponentProgress}%</span>
          </div>
        </>
      )}

      {state.phase === "result" && state.result && (
        <>
          <div className="total" style={{ color: won ? "var(--good)" : "var(--bad)" }}>
            {won ? "You won" : "You lost"}
          </div>
          <p className="who">
            Scores: {state.result.player1Score ?? "—"} vs {state.result.player2Score ?? "—"}
          </p>
          <button onClick={cancel}>New match</button>
        </>
      )}
    </section>
  );
}
