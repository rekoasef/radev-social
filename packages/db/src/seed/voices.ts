import type { VoiceProvider, VoiceUse } from "@radev/core";

// Initial voices (ADR 0027), from the ElevenLabs library, Argentine accent. Loaded only when a voice
// is missing: after that the catalog belongs to the panel. Alberto is the default narrator since
// 2026-11-24 (the operator chose him after Fran sounded "robotic"). The speed is the one saved in
// the voice, except Fran (the operator picked 1.1 by ear).

export type SeedVoice = {
  provider: VoiceProvider;
  externalId: string;
  name: string;
  use: VoiceUse;
  language: string;
  speed: number | null;
  isDefault: boolean;
};

export const seedVoices: SeedVoice[] = [
  {
    provider: "elevenlabs",
    externalId: "l1zE9xgNpUTaQCZzpNJa",
    name: "Alberto Rodríguez",
    use: "narrative",
    language: "es",
    speed: null,
    isDefault: true,
  },
  {
    provider: "elevenlabs",
    externalId: "0bu1GUsOfNJYyXbmSTxD",
    name: "Fran",
    use: "narrative",
    language: "es",
    speed: 1.1,
    isDefault: false,
  },
  {
    provider: "elevenlabs",
    externalId: "dGjL92Li0y7ZUQ3MESQW",
    name: "Juan",
    use: "narrative",
    language: "es",
    speed: null,
    isDefault: false,
  },
  {
    provider: "elevenlabs",
    externalId: "gBTPbHzRd0ZmV75Z5Zk4",
    name: "Carlos Pro",
    use: "commercial",
    language: "es",
    speed: null,
    isDefault: true,
  },
];
