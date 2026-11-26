import type { Tagged } from "type-fest";

import { Id } from "./music/id";
import { Metadata } from "./music/metadata";
import { Settings } from "./music/settings";

export type { MetadataPossiblyOld } from "./music/metadata";

type Raw = {
  id: Id;
  metadata: Metadata;
  settings: Settings;
};

export type Music = Tagged<Raw, "Music">;

export const Music = {
  create(id: Id, metadata: Metadata, settings: Settings): Music {
    return { id, metadata, settings } as Music;
  },

  Id,
  Metadata,
  Settings,
};
