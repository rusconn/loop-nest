import { debounce } from "../../lib/debounce";
import type { Music } from "../../models/music";

export const MusicSettingsStorage = {
  update({ id, settings }: Pick<Music, "id" | "settings">) {
    const snapshot = { ...settings };
    scheduledUpdates.set(id, snapshot);
    scheduleUpdate();
  },
  get(id: Music["id"]): Music["settings"] | undefined {
    const saved = localStorage.getItem(`settings:${id}`);
    return saved ? JSON.parse(saved) : undefined;
  },
  set(id: Music["id"], settings: Music["settings"]) {
    localStorage.setItem(`settings:${id}`, JSON.stringify(settings));
  },
};

const scheduledUpdates = new Map<Music["id"], Music["settings"]>();
const scheduleUpdate = debounce(doUpdates, 200);

function doUpdates() {
  for (const [id, settings] of scheduledUpdates) {
    MusicSettingsStorage.set(id, settings);
  }
  scheduledUpdates.clear();
}
