import type { VoiceProvider } from "./types";

/**
 * Provider registry. Concrete adapters land in Phase 1 and register here, e.g.
 *
 *   register(new ElevenLabsProvider(process.env.ELEVENLABS_API_KEY!));
 *
 * The battle engine resolves a provider by its id and never imports adapters
 * directly.
 */
const providers = new Map<string, VoiceProvider>();

export function register(provider: VoiceProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(id: string): VoiceProvider {
  const provider = providers.get(id);
  if (!provider) {
    throw new Error(`No voice provider registered for id "${id}"`);
  }
  return provider;
}

export function listProviders(): string[] {
  return [...providers.keys()];
}
