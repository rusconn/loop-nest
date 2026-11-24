import type { Tagged } from "type-fest";

import { hash } from "../../lib/hash";

type Raw = `music-${string}`;

export type Id = Tagged<Raw, "MusicId">;

export const Id = {
  async create(buffer: ArrayBuffer): Promise<Id> {
    return `music-${await hash("SHA-1", buffer)}` as Id;
  },
};
