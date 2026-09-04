import type { Metadata, MetadataPossiblyOld, MusicId } from "../../models/music";

export const MusicMetadataStorage = {
  get(id: MusicId): MetadataPossiblyOld | undefined {
    const saved = localStorage.getItem(`metadata:${id}`);
    return saved ? JSON.parse(saved) : undefined;
  },
  set(id: MusicId, metadata: Metadata) {
    localStorage.setItem(`metadata:${id}`, JSON.stringify(metadata));
  },
};
