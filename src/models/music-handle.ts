import type { Except, Tagged, UnwrapTagged } from "type-fest";

import { Music } from "./music";

type Raw = Except<UnwrapTagged<Music>, "settings"> & {
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
