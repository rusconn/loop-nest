import { Music } from "../../domain/music";

export const MusicMetadataStorage = {
  get(id: Music["id"]): Music["metadata"] | undefined {
    const saved = localStorage.getItem(`metadata#${id}`);
    return saved ? Music.Metadata.parse(saved) : undefined;
  },
  set(id: Music["id"], metadata: Music["metadata"]) {
    localStorage.setItem(`metadata#${id}`, JSON.stringify(metadata));
  },
};
