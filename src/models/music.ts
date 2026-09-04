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

const CURRENT_METADATA_VERSION = 2;

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

      const metadata = parseMetadata(rawMetadata, duration, file.name);
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

function parseMetadata(raw: IAudioMetadata, duration: number, defaultTitle: string): Metadata {
  const { common, format, native } = raw;
  const loopInfo = parseLoopInfo(format.sampleRate, native.vorbis, duration);

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
    ...(loopInfo != null && {
      loopInfo,
    }),
  };
}

function parseLoopInfo(
  sampleRate: number | undefined,
  vorbis: IAudioMetadata["native"]["vorbis"],
  duration: number,
): Metadata["loopInfo"] {
  if (!sampleRate || !vorbis) {
    return;
  }

  const start = parseTagAsNumber(vorbis, "LOOPSTART");
  const length = parseTagAsNumber(vorbis, "LOOPLENGTH");
  const end = parseTagAsNumber(vorbis, "LOOPEND");

  if (start == null && length == null && end == null) {
    return;
  }

  if (start == null) {
    throw new Error("LOOPLENGTH/LOOPEND present but no LOOPSTART given");
  }
  if (length == null && end == null) {
    throw new Error("LOOPSTART present but neither LOOPLENGTH nor LOOPEND given");
  }

  if (!isValidLoopPoint(start)) {
    throw new Error(`invalid LOOPSTART: ${start}`);
  }

  const startSec = start / sampleRate;

  if (length != null) {
    if (!isValidLoopPoint(length)) {
      throw new Error(`invalid LOOPLENGTH: ${length}`);
    }
    const endSec = (start + length) / sampleRate;
    if (!isInsideRound(endSec, duration)) {
      throw new Error(`LOOPSTART + LOOPLENGTH is out of range: ${endSec}`);
    }
    return { start: startSec, end: endSec };
  }

  if (end != null) {
    if (!isValidLoopPoint(end)) {
      throw new Error(`invalid LOOPEND: ${end}`);
    }
    if (start > end) {
      throw new Error(`LOOPEND is before LOOPSTART: ${end}`);
    }
    const endSec = end / sampleRate;
    if (!isInsideRound(endSec, duration)) {
      throw new Error(`LOOPEND is out of range: ${endSec}`);
    }
    return { start: startSec, end: endSec };
  }
}

function parseTagAsNumber(tags: IAudioMetadata["native"]["any"], tagId: string) {
  const tag = tags.find((tag) => tag.id === tagId);
  return tag && Number(tag.value);
}

function isValidLoopPoint(value: number) {
  return Number.isFinite(value) && 0 <= value;
}

function isInsideRound(second: number, duration: number) {
  return 0 < second && second <= duration;
}
