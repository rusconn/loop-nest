import { Music } from "../../domain/music";
import { debounce } from "../../lib/debounce";

export const MusicSettingsStorage = {
  get(id: Music["id"]): Music["settings"] | undefined {
    const scheduledUpdate = scheduledUpdates.get(id);
    if (scheduledUpdate != null) {
      return scheduledUpdate;
    }
    const saved = localStorage.getItem(`settings#${id}`);
    return saved ? Music.Settings.parse(saved) : undefined;
  },
  upsert(id: Music["id"], settings: Music["settings"]) {
    scheduledUpdates.set(id, { ...settings });
    scheduleUpdate();
  },
};

const scheduledUpdates = new Map<Music["id"], Music["settings"]>();
const scheduleUpdate = debounce(doUpdates, 200);

function set(id: Music["id"], settings: Music["settings"]) {
  localStorage.setItem(`settings#${id}`, JSON.stringify(settings));
}

function doUpdates() {
  for (const [id, settings] of scheduledUpdates) {
    set(id, settings);
  }
  scheduledUpdates.clear();
}
