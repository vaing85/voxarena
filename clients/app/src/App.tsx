import { useEffect, useState } from "react";
import {
  api,
  ApiError,
  type AudioScore,
  type LeaderboardEntry,
  type Pack,
  type Player,
  type Song,
} from "./lib/api";
import { startRecorder, type Recorder } from "./lib/audio";
import { getPlayerId, setPlayerId } from "./lib/session";
import { LivePvp } from "./LivePvp";

const MODES = ["solo_practice", "solo_vs_bot", "ranked_pvp", "tournament"];

type Msg = { text: string; kind: "ok" | "err" } | null;

function errText(e: unknown): string {
  return e instanceof ApiError ? `${e.status}: ${e.message}` : String(e);
}

function ScoreBars({ score }: { score: AudioScore }) {
  const p = score.performance;
  const rows: [string, number | null][] = [
    ["Pitch", p.scorePitch],
    ["Timing", p.scoreTiming],
    ["Stability", p.scoreStability],
    ["Dynamics", p.scoreDynamics],
    ["Transitions", p.scoreTransitions],
  ];
  return (
    <div>
      <div className="total">{p.scoreTotal ?? "—"}</div>
      <div className="bars">
        {rows.map(([label, v]) => (
          <div className="bar" key={label}>
            <span>{label}</span>
            <span className="track">
              <span className="fill" style={{ width: `${Math.max(0, Math.min(100, v ?? 0))}%` }} />
            </span>
            <span>{v ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function App() {
  const [playerId, setPid] = useState<string | null>(getPlayerId());
  const [player, setPlayer] = useState<Player | null>(null);
  const [name, setName] = useState("");

  const [songs, setSongs] = useState<Song[]>([]);
  const [songId, setSongId] = useState("");
  const [mode, setMode] = useState(MODES[0]);

  const [recorder, setRecorder] = useState<Recorder | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastScore, setLastScore] = useState<AudioScore | null>(null);

  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [msg, setMsg] = useState<Msg>(null);

  const flash = (text: string, kind: "ok" | "err") => setMsg({ text, kind });

  useEffect(() => {
    api.listSongs().then(setSongs).catch((e) => flash(errText(e), "err"));
  }, []);

  useEffect(() => {
    if (playerId) api.listPacks(playerId).then(setPacks).catch(() => {});
  }, [playerId]);

  async function register() {
    try {
      const p = await api.createPlayer(name.trim() || null, playerId);
      setPlayer(p);
      setPid(p.id);
      setPlayerId(p.id);
      flash(`Playing as ${p.name ?? "(unnamed)"} · ${p.tier} · MMR ${p.mmr}`, "ok");
    } catch (e) {
      flash(errText(e), "err");
    }
  }

  async function toggleRecord() {
    if (recorder) {
      const { blob, seconds } = recorder.stop();
      setRecorder(null);
      if (!playerId || !songId) {
        flash("Pick a song and register first.", "err");
        return;
      }
      setBusy(true);
      flash(`Recorded ${seconds.toFixed(1)}s — scoring…`, "ok");
      try {
        const score = await api.scoreAudio(playerId, songId, mode, blob);
        setLastScore(score);
        flash(`Scored ${score.performance.scoreTotal}.`, "ok");
      } catch (e) {
        flash(errText(e), "err");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!playerId) return flash("Register a player first.", "err");
    if (!songId) return flash("Pick a song first.", "err");
    try {
      setRecorder(await startRecorder());
      flash("Recording… sing the song's melody, then Stop.", "ok");
    } catch (e) {
      flash(`Mic access failed: ${errText(e)} (needs HTTPS or localhost).`, "err");
    }
  }

  async function loadBoard() {
    if (!songId) return flash("Pick a song first.", "err");
    try {
      setBoard(await api.leaderboard(songId, 20));
    } catch (e) {
      flash(errText(e), "err");
    }
  }

  return (
    <>
      <header>
        <h1>VoxArena</h1>
        <span className="tag">web app</span>
        {player && <span className="tag">{player.tier} · MMR {player.mmr}</span>}
      </header>
      <main>
        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        <section className="panel">
          <h2>Player</h2>
          <label htmlFor="name">Name (optional)</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Demo Singer" />
          <button onClick={register}>{playerId ? "Re-register" : "Create player"}</button>
          <p className="who">{playerId ? <>id <b>{playerId}</b></> : "No player yet."}</p>
        </section>

        <section className="panel">
          <h2>Sing &amp; score</h2>
          <label htmlFor="song">Song</label>
          <select id="song" value={songId} onChange={(e) => setSongId(e.target.value)}>
            <option value="">— select a song —</option>
            {songs.map((s) => (
              <option key={s.id} value={s.id}>{s.title} ({s.difficulty})</option>
            ))}
          </select>
          <label htmlFor="mode">Mode</label>
          <select id="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button className={recorder ? "recording" : ""} onClick={toggleRecord} disabled={busy}>
            {recorder ? "⏹ Stop & score" : "🎤 Record"}
          </button>
          {lastScore && <ScoreBars score={lastScore} />}
        </section>

        <section className="panel">
          <h2>Leaderboard</h2>
          <button className="secondary" onClick={loadBoard}>Load for selected song</button>
          {board.length > 0 && (
            <table>
              <thead><tr><th>#</th><th>Player</th><th>Total</th></tr></thead>
              <tbody>
                {board.map((r) => (
                  <tr key={r.id}>
                    <td>{r.rank}</td>
                    <td>{r.player?.name ?? r.playerId.slice(0, 8)}</td>
                    <td>{r.scoreTotal ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {playerId && <LivePvp playerId={playerId} songId={songId} />}

        {packs.length > 0 && (
          <section className="panel">
            <h2>Song packs</h2>
            {packs.map((p) => (
              <p className="who" key={p.id}>
                <b>{p.name}</b> · {p.songCount} song(s) · {p.owned ? "owned" : `${(p.priceCents / 100).toFixed(2)} ${p.currency.toUpperCase()}`}
              </p>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
