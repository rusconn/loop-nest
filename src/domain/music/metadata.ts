import { parseBuffer, type IAudioMetadata } from "music-metadata";
import type { Tagged } from "type-fest";

type Raw = {
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

export type Metadata = Tagged<Raw, "MusicMetadata">;

export type MetadataPossiblyOld = Metadata;

export type ParseResult =
  | { kind: "ok"; metadata: Metadata }
  | { kind: "unreadable"; cause: unknown }
  | { kind: "no-duration" }
  | { kind: "invalid-loop"; message: string };

export const Metadata = {
  CURRENT_VERSION: 2,

  async parse(buffer: ArrayBuffer, mimeType: string, defaultTitle: string): Promise<ParseResult> {
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

    const { common, format, native } = rawMetadata;
    const result = parseLoopInfo(format.sampleRate, native.vorbis, duration);

    if (result.kind === "err") {
      return { kind: "invalid-loop", message: result.message };
    }

    return {
      kind: "ok",
      metadata: {
        version: Metadata.CURRENT_VERSION,
        common: {
          title: common.title?.trim() || defaultTitle,
          artist: common.artist?.trim(),
          album: common.album?.trim(),
        },
        format: {
          duration,
          sampleRate: format.sampleRate,
        },
        loopInfo: result.loopInfo,
      } as Metadata,
    };
  },
};

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
