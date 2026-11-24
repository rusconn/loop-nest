import type { Tagged } from "type-fest";

type Raw = {
  volume: number;
  tempo: number;
};

export type Settings = Tagged<Raw, "MusicSettings">;

export const Settings = {
  create(): Settings {
    return { volume: 1, tempo: 1 } as Settings;
  },
};
