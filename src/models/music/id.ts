import type { Tagged } from "type-fest";

import { hash } from "../../lib/hash";

type Raw = `music-${string}`;

export type Id = Tagged<Raw, "MusicId">;

export const Id = {
  create(file: File): Id {
    return `music-${file.name.normalize("NFC")}-${file.size}-${file.lastModified}` as Id;
  },

  // TODO: remove legacy migration
  async createLegacy(buffer: ArrayBuffer): Promise<Id> {
    return `music-${await hash("SHA-1", buffer)}` as Id;
  },
};
