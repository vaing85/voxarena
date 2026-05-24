/**
 * One interface, many voice backends. Every TTS provider (ElevenLabs, OpenAI,
 * Cartesia, ...) is wrapped in a VoiceProvider so the battle engine never has
 * to know which vendor it is talking to.
 */

export interface SynthesizeRequest {
  /** Text to be spoken. */
  text: string;
  /** Provider-specific voice/model identifier (see VoiceModel.providerModelId). */
  providerModelId: string;
}

export interface SynthesizeResult {
  /** Raw audio bytes returned by the provider. */
  audio: Uint8Array;
  /** MIME type of the audio, e.g. "audio/mpeg". */
  contentType: string;
}

export interface VoiceProvider {
  /** Stable provider key, e.g. "elevenlabs". */
  readonly id: string;
  /** Turn text into speech. Throws on provider/network failure. */
  synthesize(req: SynthesizeRequest): Promise<SynthesizeResult>;
}

/** A competitor in the arena, mapped to a concrete provider voice. */
export interface VoiceModel {
  id: string;
  slug: string;
  displayName: string;
  provider: string;
  providerModelId: string;
}
