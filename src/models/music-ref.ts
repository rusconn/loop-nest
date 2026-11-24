import { Music, type MusicId } from "./music";
import { MusicMetadataStorage } from "../storage/music/metadata";
import { MusicSettingsStorage } from "../storage/music/settings";

export type MusicRef = {
  id: MusicId;
  file: File;
};

export async function loadMusic(ref: MusicRef): Promise<Music> {
  const { id, file } = ref;
  const buffer = await file.arrayBuffer();

  const savedMetadata = MusicMetadataStorage.get(id);
  const savedSettings = MusicSettingsStorage.get(id);
  const isOldMetadata =
    savedMetadata != null && savedMetadata.version < Music.CURRENT_METADATA_VERSION;

  if (savedMetadata && savedSettings && !isOldMetadata) {
    return { id, buffer, metadata: savedMetadata, settings: savedSettings };
  }

  const result = await Music.parse(id, buffer, file.type, file.name);

  switch (result.kind) {
    case "ok": {
      const { music } = result;
      if (!savedMetadata || isOldMetadata) {
        MusicMetadataStorage.set(id, music.metadata);
      }
      if (!savedSettings) {
        MusicSettingsStorage.set(id, music.settings);
      }
      return music;
    }
    case "invalid-loop":
      throw new Error(result.message);
    case "unreadable":
      throw result.cause instanceof Error
        ? result.cause
        : new Error(String(result.cause ?? "unreadable file"));
    case "no-duration":
      throw new Error("failed to parse duration");
    default:
      throw new Error(result satisfies never);
  }
}
