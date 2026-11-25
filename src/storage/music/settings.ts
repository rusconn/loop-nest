import { debounce } from "../../lib/debounce";
import type { Music } from "../../models/music";
import { Settings } from "../../models/music/settings";

export const MusicSettingsStorage = {
  get(id: Music["id"]): Settings | undefined {
    const scheduledUpdate = scheduledUpdates.get(id);
    if (scheduledUpdate != null) {
      return scheduledUpdate;
    }
    const saved = localStorage.getItem(`settings:${id}`);
    return saved ? Settings.parse(saved) : undefined;
  },
  upsert(id: Music["id"], settings: Settings) {
    scheduledUpdates.set(id, { ...settings });
    scheduleUpdate();
  },
};

const scheduledUpdates = new Map<Music["id"], Settings>();
const scheduleUpdate = debounce(doUpdates, 200);

function set(id: Music["id"], settings: Settings) {
  localStorage.setItem(`settings:${id}`, JSON.stringify(settings));
}

function doUpdates() {
  for (const [id, settings] of scheduledUpdates) {
    set(id, settings);
  }
  scheduledUpdates.clear();
}
