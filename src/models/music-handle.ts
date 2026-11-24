import type { Except, Tagged, UnwrapTagged } from "type-fest";

import { Music } from "./music";

// Musicよりもメモリが小さい
type Raw = Except<UnwrapTagged<Music>, "buffer"> & {
  file: File;
};

export type MusicHandle = Tagged<Raw, "MusicHandle">;

export const MusicHandle = {
  create(
    id: Music["id"],
    metadata: Music["metadata"],
    settings: Music["settings"],
    file: File,
  ): MusicHandle {
    return {
      id,
      metadata,
      settings,
      file,
    } as MusicHandle;
  },
};
