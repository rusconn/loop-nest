import type { Metadata, MusicId, Settings } from "../models/music";
import { MusicMetadataStorage } from "./music/metadata";
import { MusicSettingsStorage } from "./music/settings";

type Version = "1" | "2";

export function migrateIfNeeded() {
  let version = localStorage.getItem("version") as Version | null;

  if (version == null) {
    localStorage.setItem("version", "2");
    version = "2";
  }

  // Using fallthrough. Only the latest version of the case clause contains `break;`.
  switch (version) {
    case "1":
      to2();
    case "2":
      break;
    default:
      throw new Error(`unknown version: ${version satisfies never}`);
  }
}

function to2() {
  const keys: (string | null)[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    keys.push(localStorage.key(i));
  }

  for (const key of keys) {
    if (key?.startsWith("music-")) {
      const val = localStorage.getItem(key);
      if (val == null) continue;
      try {
        const { metadata, settings } = JSON.parse(val) as {
          metadata: Metadata;
          settings: Settings;
        };
        MusicMetadataStorage.set(key as MusicId, metadata);
        MusicSettingsStorage.set(key as MusicId, settings);
        localStorage.removeItem(key);
      } catch (e) {
        console.error(`Failed to migrate ${key}:`, e);
      }
    }
  }

  localStorage.setItem("version", "2");
}
