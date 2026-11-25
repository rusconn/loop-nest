import type { Tagged } from "type-fest";

import { clamp } from "../../lib/math";

type Raw = {
  volume: number;
  tempo: number;
};

export type Settings = Tagged<Raw, "MusicSettings">;

const VOLUME_MIN = 0;
const VOLUME_MAX = 1;
const TEMPO_MIN = 0.5;
const TEMPO_MAX = 1.5;

export const Settings = {
  create(): Settings {
    return { volume: 1, tempo: 1 } as Settings;
  },

  parse(input: string): Settings | undefined {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch {
      return undefined;
    }

    if (typeof parsed !== "object" || parsed == null) {
      return undefined;
    }
    if (!("volume" in parsed) || typeof parsed.volume !== "number") {
      return undefined;
    }
    if (!("tempo" in parsed) || typeof parsed.tempo !== "number") {
      return undefined;
    }

    return {
      volume: clamp(parsed.volume, VOLUME_MIN, VOLUME_MAX),
      tempo: clamp(parsed.tempo, TEMPO_MIN, TEMPO_MAX),
    } as Settings;
  },

  withVolume(settings: Settings, volume: number): Settings {
    return { ...settings, volume: clamp(volume, VOLUME_MIN, VOLUME_MAX) };
  },

  withTempo(settings: Settings, tempo: number): Settings {
    return { ...settings, tempo: clamp(tempo, TEMPO_MIN, TEMPO_MAX) };
  },
};
