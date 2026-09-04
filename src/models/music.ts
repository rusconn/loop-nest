import { parseBuffer, type IAudioMetadata } from "music-metadata";

import { hash } from "../lib/hash";

export type Music = {
  id: MusicId;
  buffer: ArrayBuffer;
  metadata: Metadata;
  settings: Settings;
};

export type MusicId = `music-${string}`;

export type MetadataPossiblyOld = Metadata;

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

export const CURRENT_METADATA_VERSION = 2;

export type ParseResult =
  | { kind: "ok"; music: Music }
  | { kind: "invalid-loop"; music: Music; message: string }
  | { kind: "no-duration" }
  | { kind: "unreadable"; cause: unknown };

export const Music = {
  async id(buffer: ArrayBuffer): Promise<MusicId> {
    return `music-${await hash("SHA-1", buffer)}`;
  },

  async parse(
    id: MusicId,
    buffer: ArrayBuffer,
    mimeType: string,
    fileName: string,
  ): Promise<ParseResult> {
    let rawMetadata: IAudioMetadata;
    try {
      rawMetadata = await parseBuffer(new Uint8Array(buffer), mimeType, {
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

    const { metadata, loopError } = parseMetadata(rawMetadata, duration, fileName);
    const settings: Settings = { volume: 1, tempo: 1 };
    const music: Music = { id, buffer, metadata, settings };

    if (loopError != null) {
      return { kind: "invalid-loop", music, message: loopError };
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

  const loopStart = parseTagAsNumber(vorbis, "LOOPSTART");
  const loopLength = parseTagAsNumber(vorbis, "LOOPLENGTH");
  const loopEnd = parseTagAsNumber(vorbis, "LOOPEND");

  if (loopStart == null && loopLength == null && loopEnd == null) {
    return { kind: "ok", loopInfo: undefined };
  }

  if (loopStart == null) {
    return { kind: "err", message: "LOOPLENGTH/LOOPEND present but no LOOPSTART given" };
  }
  if (loopLength == null && loopEnd == null) {
    return { kind: "err", message: "LOOPSTART present but neither LOOPLENGTH nor LOOPEND given" };
  }

  if (!isValidLoopPoint(loopStart)) {
    return { kind: "err", message: `invalid LOOPSTART: ${loopStart}` };
  }

  const start = loopStart / sampleRate;

  if (loopLength != null) {
    if (!isValidLoopPoint(loopLength)) {
      return { kind: "err", message: `invalid LOOPLENGTH: ${loopLength}` };
    }
    const end = (loopStart + loopLength) / sampleRate;
    if (!isInsideRound(end, duration)) {
      return { kind: "err", message: `LOOPSTART + LOOPLENGTH is out of range: ${end}` };
    }
    return { kind: "ok", loopInfo: { start, end } };
  }

  if (loopEnd != null) {
    if (!isValidLoopPoint(loopEnd)) {
      return { kind: "err", message: `invalid LOOPEND: ${loopEnd}` };
    }
    if (loopStart > loopEnd) {
      return { kind: "err", message: `LOOPEND is before LOOPSTART: ${loopEnd}` };
    }
    const end = loopEnd / sampleRate;
    if (!isInsideRound(end, duration)) {
      return { kind: "err", message: `LOOPEND is out of range: ${end}` };
    }
    return { kind: "ok", loopInfo: { start, end } };
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
