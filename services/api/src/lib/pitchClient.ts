/** Client for the Python pitch service (services/pitch). */

export type PitchAnalysis = {
  scorePitch: number | null;
  evaluatedFrames: number;
  voicedFrames: number;
  totalFrames: number;
  voicedRatio: number;
  meanCentsError: number | null;
  scoreTiming: number | null;
  matchedOnsets: number;
  referenceOnsets: number;
  meanOnsetErrorMs: number | null;
  scoreStability: number | null;
  evaluatedNotes: number;
  meanStdCents: number | null;
  scoreDynamics: number | null;
  meanCv: number | null;
  scoreTransitions: number | null;
  evaluatedTransitions: number;
  meanSettleRatio: number | null;
  sampleRate?: number;
  durationSec?: number;
};

export function isPitchServiceConfigured(): boolean {
  return Boolean(process.env.PITCH_SERVICE_URL);
}

/**
 * POST audio + reference notes to the pitch service and return its analysis.
 * Throws if the service is unset or responds with a non-2xx status.
 */
export async function analyzePitch(
  audio: Buffer,
  filename: string,
  contentType: string,
  referenceNotes: unknown
): Promise<PitchAnalysis> {
  const base = process.env.PITCH_SERVICE_URL;
  if (!base) throw new Error("PITCH_SERVICE_URL not set");

  const form = new FormData();
  form.append(
    "audio",
    new Blob([new Uint8Array(audio)], { type: contentType || "audio/wav" }),
    filename || "audio.wav"
  );
  form.append("reference", JSON.stringify(referenceNotes ?? []));

  const res = await fetch(`${base.replace(/\/$/, "")}/analyze`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`pitch service responded ${res.status}: ${text}`);
  }
  return (await res.json()) as PitchAnalysis;
}
