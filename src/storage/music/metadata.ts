import type { MetadataPossiblyOld, Music } from "../../models/music";

export const MusicMetadataStorage = {
  get(id: Music["id"], sep = "#"): MetadataPossiblyOld | undefined {
    const saved = localStorage.getItem(`metadata${sep}${id}`);
    return saved ? JSON.parse(saved) : undefined;
  },
  getLegacy(id: Music["id"]): MetadataPossiblyOld | undefined {
    return MusicMetadataStorage.get(id, ":");
  },
  set(id: Music["id"], metadata: Music["metadata"]) {
    localStorage.setItem(`metadata#${id}`, JSON.stringify(metadata));
  },
  // TODO: remove legacy migration
  deleteLegacy(id: Music["id"]) {
    localStorage.removeItem(`metadata:${id}`);
  },
};
