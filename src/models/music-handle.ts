import type { Except, Tagged, UnwrapTagged } from "type-fest";

import { Music } from "./music";

// Musicよりもメモリが小さい
type Raw = Except<UnwrapTagged<Music>, "settings" | "buffer"> & {
  file: File;
};

export type MusicHandle = Tagged<Raw, "MusicHandle">;

export const MusicHandle = {
  create(id: Music["id"], metadata: Music["metadata"], file: File): MusicHandle {
    return {
      id,
      metadata,
      file,
    } as MusicHandle;
  },
};
