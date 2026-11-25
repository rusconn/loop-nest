import type { Tagged } from "type-fest";

type Raw = `music-${string}`;

export type Id = Tagged<Raw, "MusicId">;

export const Id = {
  create(file: File): Id {
    return `music-${file.name.normalize("NFC")}-${file.size}-${file.lastModified}` as Id;
  },
};
