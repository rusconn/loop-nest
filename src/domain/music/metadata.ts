import { parseBuffer, type IAudioMetadata } from "music-metadata";
import type { Tagged } from "type-fest";

import { isOptionalString, isPositiveFiniteNumber, isRecord } from "../../lib/type-guard";

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

export type ParseFileResult =
  | { kind: "ok"; metadata: Metadata }
  | { kind: "unreadable"; cause: unknown }
  | { kind: "invalid-metadata"; cause: unknown }
  | { kind: "no-duration" }
  | { kind: "invalid-loop"; message: string };

const CURRENT_VERSION = 2;

export const Metadata = {
  parse(input: string): Metadata | undefined {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch {
      return undefined;
    }

    if (!isRecord(parsed) || parsed.version !== CURRENT_VERSION) {
      return undefined;
    }

    const common = parseCommon(parsed.common);
    if (common == null) {
      return undefined;
    }

    const format = parseFormat(parsed.format);
    if (format == null) {
      return undefined;
    }

    let loopInfo: Raw["loopInfo"] | undefined;
    if ("loopInfo" in parsed) {
      const info = parseLoopInfo(parsed.loopInfo, format.duration);
      if (info == null) {
        return undefined;
      }
      loopInfo = info;
    }

    return {
      version: CURRENT_VERSION,
      common,
      format,
      ...(loopInfo != null && {
        loopInfo,
      }),
    } as Metadata;
  },

  async parseFile(file: File): Promise<ParseFileResult> {
    let buffer: ArrayBuffer;
    try {
      buffer = await file.arrayBuffer();
    } catch (e) {
      return { kind: "unreadable", cause: e };
    }

    let rawMetadata: IAudioMetadata;
    try {
      rawMetadata = await parseBuffer(new Uint8Array(buffer), file.type, {
        skipCovers: true,
        duration: true,
      });
    } catch (e) {
      return { kind: "invalid-metadata", cause: e };
    }

    const { duration } = rawMetadata.format;
    if (duration == null) {
      return { kind: "no-duration" };
    }

    const { common, format, native } = rawMetadata;
    const result = parseFileLoopInfo(format.sampleRate, native.vorbis, duration);

    if (result.kind === "err") {
      return { kind: "invalid-loop", message: result.message };
    }

    return {
      kind: "ok",
      metadata: {
        version: CURRENT_VERSION,
        common: {
          title: common.title?.trim() || file.name,
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

function parseCommon(value: unknown): Raw["common"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (typeof value.title !== "string" || value.title.length === 0) {
    return undefined;
  }
  if (!isOptionalString(value.artist) || !isOptionalString(value.album)) {
    return undefined;
  }

  return {
    title: value.title,
    artist: value.artist,
    album: value.album,
  };
}

function parseFormat(value: unknown): Raw["format"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (!isPositiveFiniteNumber(value.duration)) {
    return undefined;
  }
  if (value.sampleRate !== undefined && !isPositiveFiniteNumber(value.sampleRate)) {
    return undefined;
  }

  return {
    duration: value.duration,
    sampleRate: value.sampleRate,
  };
}

function parseLoopInfo(value: unknown, duration: number): Raw["loopInfo"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { start, end } = value;
  if (typeof start !== "number" || typeof end !== "number") {
    return undefined;
  }

  const result = createLoopInfo(start, end, duration);
  return result.kind === "ok" ? result.loopInfo : undefined;
}

type ParseLoopInfoResult =
  | { kind: "ok"; loopInfo?: Metadata["loopInfo"] } //
  | { kind: "err"; message: string };

function parseFileLoopInfo(
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

  if (loopLength != null && !isValidLoopPoint(loopLength)) {
    return { kind: "err", message: `invalid LOOPLENGTH: ${loopLength}` };
  }

  const endSample = loopLength != null ? loopStart + loopLength : loopEnd!;
  return createLoopInfo(loopStart / sampleRate, endSample / sampleRate, duration);
}

type CreateLoopInfoResult =
  | { kind: "ok"; loopInfo: NonNullable<Raw["loopInfo"]> } //
  | { kind: "err"; message: string };

function createLoopInfo(start: number, end: number, duration: number): CreateLoopInfoResult {
  if (!isValidLoopPoint(start)) {
    return { kind: "err", message: `invalid loop start: ${start}` };
  }
  if (!isValidLoopPoint(end)) {
    return { kind: "err", message: `invalid loop end: ${end}` };
  }
  if (start > end) {
    return { kind: "err", message: `loop end is before loop start: ${end}` };
  }
  if (!isInsideRound(end, duration)) {
    return { kind: "err", message: `loop end is out of range: ${end}` };
  }

  return { kind: "ok", loopInfo: { start, end } };
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
