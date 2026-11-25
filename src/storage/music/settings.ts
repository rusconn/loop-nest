import { debounce } from "../../lib/debounce";
import type { Music } from "../../models/music";
import { Settings } from "../../models/music/settings";

export const MusicSettingsStorage = {
  get(id: Music["id"], sep = "#"): Settings | undefined {
    const scheduledUpdate = scheduledUpdates.get(id);
    if (scheduledUpdate != null) {
      return scheduledUpdate;
    }
    const saved = localStorage.getItem(`settings${sep}${id}`);
    return saved ? Settings.parse(saved) : undefined;
  },
  getLegacy(id: Music["id"]): Settings | undefined {
    return MusicSettingsStorage.get(id, ":");
  },
  upsert(id: Music["id"], settings: Settings) {
    scheduledUpdates.set(id, { ...settings });
    scheduleUpdate();
  },
  // TODO: remove legacy migration
  deleteLegacy(id: Music["id"]) {
    localStorage.removeItem(`settings:${id}`);
  },
};

const scheduledUpdates = new Map<Music["id"], Settings>();
const scheduleUpdate = debounce(doUpdates, 200);

function set(id: Music["id"], settings: Settings) {
  localStorage.setItem(`settings#${id}`, JSON.stringify(settings));
}

function doUpdates() {
  for (const [id, settings] of scheduledUpdates) {
    set(id, settings);
  }
  scheduledUpdates.clear();
}
