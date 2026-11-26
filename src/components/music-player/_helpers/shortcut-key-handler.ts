import { Shortcut } from "./shortcut";
import { dispatchTypedEvent } from "../../../utils/event";

export type ShortcutKeyHandlerEventMap = {
  "shortcut-key-handler:toggle-playing": CustomEvent<{}>;
  "shortcut-key-handler:toggle-mute": CustomEvent<{}>;
  "shortcut-key-handler:seek-backward": CustomEvent<{ secs: number }>;
  "shortcut-key-handler:seek-forward": CustomEvent<{ secs: number }>;
  "shortcut-key-handler:change-volume": CustomEvent<{ delta: number }>;
  "shortcut-key-handler:change-tempo": CustomEvent<{ delta: number }>;
};

export class ShortcutKeyHandler extends EventTarget {
  register() {
    document.addEventListener("keydown", this.#handleShortcutKeyDown);
  }

  unregister() {
    document.removeEventListener("keydown", this.#handleShortcutKeyDown);
  }

  #handleShortcutKeyDown = (e: KeyboardEvent) => {
    const shortcut = Shortcut.parse(e);

    if (!shortcut) {
      return;
    }

    e.preventDefault();

    switch (shortcut) {
      case "toggle-playing":
        dispatchTypedEvent(this, "shortcut-key-handler:toggle-playing", {});
        break;
      case "toggle-mute":
        dispatchTypedEvent(this, "shortcut-key-handler:toggle-mute", {});
        break;
      case "seek-backward":
        dispatchTypedEvent(this, "shortcut-key-handler:seek-backward", { secs: 5 });
        break;
      case "seek-forward":
        dispatchTypedEvent(this, "shortcut-key-handler:seek-forward", { secs: 5 });
        break;
      case "down-volume":
        dispatchTypedEvent(this, "shortcut-key-handler:change-volume", { delta: -0.05 });
        break;
      case "up-volume":
        dispatchTypedEvent(this, "shortcut-key-handler:change-volume", { delta: 0.05 });
        break;
      case "down-tempo":
        dispatchTypedEvent(this, "shortcut-key-handler:change-tempo", { delta: -0.01 });
        break;
      case "up-tempo":
        dispatchTypedEvent(this, "shortcut-key-handler:change-tempo", { delta: 0.01 });
        break;
      default:
        shortcut satisfies never;
    }
  };
}
