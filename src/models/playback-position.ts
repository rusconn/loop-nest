import type { Tagged } from "type-fest";

import { clamp } from "../lib/math";

export type PlaybackPosition = Tagged<number, "PlaybackPosition">;

export const PlaybackPosition = {
  clamp(sec: number, duration: number): PlaybackPosition {
    return clamp(sec, 0, duration) as PlaybackPosition;
  },

  shift(current: number, delta: number, duration: number): PlaybackPosition {
    return PlaybackPosition.clamp(current + delta, duration);
  },
};
