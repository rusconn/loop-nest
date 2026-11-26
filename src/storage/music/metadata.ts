import type { MetadataPossiblyOld, Music } from "../../domain/music";

export const MusicMetadataStorage = {
  get(id: Music["id"]): MetadataPossiblyOld | undefined {
    const saved = localStorage.getItem(`metadata#${id}`);
    return saved ? JSON.parse(saved) : undefined;
  },
  set(id: Music["id"], metadata: Music["metadata"]) {
    localStorage.setItem(`metadata#${id}`, JSON.stringify(metadata));
  },
};
