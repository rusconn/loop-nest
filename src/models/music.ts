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

export type ParseResult =
  | { kind: "ok"; music: Music }
  | { kind: "invalid-loop"; music: Music; message: string }
  | { kind: "no-duration" }
  | { kind: "unreadable"; cause: unknown };

export const Music = {
  async parse(file: File): Promise<ParseResult> {
    const buffer = await file.arrayBuffer();
    const id = `music-${await hash("SHA-1", buffer)}` as const;
    const savedMetadata = MusicMetadataStorage.get(id);
    const savedSettings = MusicSettingsStorage.get(id);

    const isOldMetadata =
      savedMetadata != null &&
      (!("version" in savedMetadata) || savedMetadata.version < CURRENT_METADATA_VERSION);

    if (savedMetadata && savedSettings && !isOldMetadata) {
      return { kind: "ok", music: { id, file, metadata: savedMetadata, settings: savedSettings } };
    }

    let rawMetadata: IAudioMetadata;
    try {
      rawMetadata = await parseBuffer(new Uint8Array(buffer), file.type, {
        skipCovers: true,
        duration: true,
      });
    } catch (e) {
      return { kind: "unreadable", cause: e };
    }

    const { duration } = rawMetadata.format;
    if (duration == null) {
      return { kind: "no-duration" };
    }

    const { metadata, loopError } = parseMetadata(rawMetadata, duration, file.name);
    const settings = savedSettings ?? { volume: 1, tempo: 1 };

    const music: Music = { id, file, metadata, settings };

    if (loopError != null) {
      return { kind: "invalid-loop", music, message: loopError };
    }

    if (!savedMetadata || isOldMetadata) {
      MusicMetadataStorage.set(id, metadata);
    }
    if (!savedSettings) {
      MusicSettingsStorage.set(id, settings);
    }

    return { kind: "ok", music };
  },
};

function parseMetadata(
  raw: IAudioMetadata,
  duration: number,
  defaultTitle: string,
): { metadata: Metadata; loopError?: string } {
  const { common, format, native } = raw;
  const result = parseLoopInfo(format.sampleRate, native.vorbis, duration);

  return {
    metadata: {
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
      ...(result.kind === "ok" && {
        loopInfo: result.loopInfo,
      }),
    },
    ...(result.kind === "err" && {
      loopError: result.message,
    }),
  };
}

type ParseLoopInfoResult =
  | { kind: "ok"; loopInfo?: Metadata["loopInfo"] } //
  | { kind: "err"; message: string };

function parseLoopInfo(
  sampleRate: number | undefined,
  vorbis: IAudioMetadata["native"]["vorbis"],
  duration: number,
): ParseLoopInfoResult {
  if (!sampleRate || !vorbis) {
    return { kind: "ok" };
  }

  const start = parseTagAsNumber(vorbis, "LOOPSTART");
  const length = parseTagAsNumber(vorbis, "LOOPLENGTH");
  const end = parseTagAsNumber(vorbis, "LOOPEND");

  if (start == null && length == null && end == null) {
    return { kind: "ok" };
  }

  if (start == null) {
    return { kind: "err", message: "LOOPLENGTH/LOOPEND present but no LOOPSTART given" };
  }
  if (length == null && end == null) {
    return { kind: "err", message: "LOOPSTART present but neither LOOPLENGTH nor LOOPEND given" };
  }

  if (!isValidLoopPoint(start)) {
    return { kind: "err", message: `invalid LOOPSTART: ${start}` };
  }

  const startSec = start / sampleRate;

  if (length != null) {
    if (!isValidLoopPoint(length)) {
      return { kind: "err", message: `invalid LOOPLENGTH: ${length}` };
    }
    const endSec = (start + length) / sampleRate;
    if (!isInsideRound(endSec, duration)) {
      return { kind: "err", message: `LOOPSTART + LOOPLENGTH is out of range: ${endSec}` };
    }
    return { kind: "ok", loopInfo: { start: startSec, end: endSec } };
  }

  if (end != null) {
    if (!isValidLoopPoint(end)) {
      return { kind: "err", message: `invalid LOOPEND: ${end}` };
    }
    if (start > end) {
      return { kind: "err", message: `LOOPEND is before LOOPSTART: ${end}` };
    }
    const endSec = end / sampleRate;
    if (!isInsideRound(endSec, duration)) {
      return { kind: "err", message: `LOOPEND is out of range: ${endSec}` };
    }
    return { kind: "ok", loopInfo: { start: startSec, end: endSec } };
  }

  throw new Error("unreachable");
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
