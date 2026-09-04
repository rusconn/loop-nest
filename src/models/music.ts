import { parseBuffer, type IAudioMetadata } from "music-metadata";

import { hash } from "../lib/hash";
import { MusicMetadataStorage } from "../storage/music/metadata";
import { MusicSettingsStorage } from "../storage/music/settings";

export type Music = {
  id: MusicId;
  file: File;
  metadata: Metadata;
  settings: Settings;
};

export type MusicId = `music-${string}`;

export type MetadataPossiblyOld = IAudioMetadata | Metadata;

export type Metadata = {
  version: number;
  common: {
    title: string;
    artist?: string;
    album?: string;
  };
  format: {
    duration: number;
    sampleRate?: number;
  };
  loopInfo?: {
    start: number;
    end: number;
  };
};

export type Settings = {
  volume: number;
  tempo: number;
};

const CURRENT_METADATA_VERSION = 1;

export const Music = {
  async parse(file: File): Promise<Music | undefined> {
    const buffer = await file.arrayBuffer();
    const id = `music-${await hash("SHA-1", buffer)}` as const;
    const savedMetadata = MusicMetadataStorage.get(id);
    const savedSettings = MusicSettingsStorage.get(id);

    const isOldMetadata =
      savedMetadata != null &&
      (!("version" in savedMetadata) || savedMetadata.version < CURRENT_METADATA_VERSION);

    if (savedMetadata && savedSettings && !isOldMetadata) {
      return { id, file, metadata: savedMetadata, settings: savedSettings };
    }

    try {
      const rawMetadata = await parseBuffer(new Uint8Array(buffer), file.type, {
        skipCovers: true,
        duration: true,
      });
      const { duration } = rawMetadata.format;
      if (duration == null) {
        return undefined;
      }

      const metadata = createMetadata(rawMetadata, duration, file.name);
      const settings = savedSettings ?? { volume: 1, tempo: 1 };

      if (!savedMetadata || isOldMetadata) {
        MusicMetadataStorage.set(id, metadata);
      }
      if (!savedSettings) {
        MusicSettingsStorage.set(id, settings);
      }

      return { id, file, metadata, settings };
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },
};

function createMetadata(raw: IAudioMetadata, duration: number, defaultTitle: string): Metadata {
  const { common, format, native } = raw;
  const loopInfo = getLoopInfo(format.sampleRate, native.vorbis);

  return {
    version: CURRENT_METADATA_VERSION,
    common: {
      title: common.title?.trim() || defaultTitle,
      artist: common.artist?.trim(),
      album: common.album?.trim(),
    },
    format: {
      duration,
      sampleRate: format.sampleRate,
    },
    loopInfo,
  };
}

function getLoopInfo(
  sampleRate: number | undefined,
  vorbis: IAudioMetadata["native"]["vorbis"],
): Metadata["loopInfo"] {
  if (!sampleRate || !vorbis) return;

  const start = parseTagAsNumber(vorbis, "LOOPSTART");
  const length = parseTagAsNumber(vorbis, "LOOPLENGTH");
  const end = parseTagAsNumber(vorbis, "LOOPEND");

  if (start != null) {
    if (length != null) {
      return { start: start / sampleRate, end: (start + length) / sampleRate };
    }
    if (end != null) {
      return { start: start / sampleRate, end: end / sampleRate };
    }
  }
}

function parseTagAsNumber(tags: IAudioMetadata["native"]["any"], tagId: string) {
  const tag = tags.find((tag) => tag.id === tagId);
  return tag && Number(tag.value);
}
