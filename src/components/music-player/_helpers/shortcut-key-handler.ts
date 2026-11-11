import { Shortcut } from "./shortcut";
import { dispatchTypedEvent } from "../../../utils/event";

export type ShortcutKeyHandlerEventMap = {
  "shortcut-key-handler:toggle-playing": CustomEvent<{}>;
  "shortcut-key-handler:toggle-mute": CustomEvent<{}>;
  "shortcut-key-handler:seek-backward": CustomEvent<{ secs: number }>;
  "shortcut-key-handler:seek-forward": CustomEvent<{ secs: number }>;
  "shortcut-key-handler:down-volume": CustomEvent<{ amount: number }>;
  "shortcut-key-handler:up-volume": CustomEvent<{ amount: number }>;
  "shortcut-key-handler:down-tempo": CustomEvent<{ amount: number }>;
  "shortcut-key-handler:up-tempo": CustomEvent<{ amount: number }>;
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
        dispatchTypedEvent(this, "shortcut-key-handler:down-volume", { amount: 0.05 });
        break;
      case "up-volume":
        dispatchTypedEvent(this, "shortcut-key-handler:up-volume", { amount: 0.05 });
        break;
      case "down-tempo":
        dispatchTypedEvent(this, "shortcut-key-handler:down-tempo", { amount: 0.01 });
        break;
      case "up-tempo":
        dispatchTypedEvent(this, "shortcut-key-handler:up-tempo", { amount: 0.01 });
        break;
      default:
        shortcut satisfies never;
    }
  };
}
