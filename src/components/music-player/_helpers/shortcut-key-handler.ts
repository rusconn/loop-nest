import { Shortcut } from "./shortcut";

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
        this.#dispatchEvent("shortcut-key-handler:toggle-playing", {});
        break;
      case "toggle-mute":
        this.#dispatchEvent("shortcut-key-handler:toggle-mute", {});
        break;
      case "seek-backward":
        this.#dispatchEvent("shortcut-key-handler:seek-backward", { secs: 5 });
        break;
      case "seek-forward":
        this.#dispatchEvent("shortcut-key-handler:seek-forward", { secs: 5 });
        break;
      case "down-volume":
        this.#dispatchEvent("shortcut-key-handler:down-volume", { amount: 0.05 });
        break;
      case "up-volume":
        this.#dispatchEvent("shortcut-key-handler:up-volume", { amount: 0.05 });
        break;
      case "down-tempo":
        this.#dispatchEvent("shortcut-key-handler:down-tempo", { amount: 0.01 });
        break;
      case "up-tempo":
        this.#dispatchEvent("shortcut-key-handler:up-tempo", { amount: 0.01 });
        break;
      default:
        shortcut satisfies never;
    }
  };

  #dispatchEvent<Type extends keyof ShortcutKeyHandlerEventMap>(
    type: Type,
    detail: ShortcutKeyHandlerEventMap[Type] extends CustomEvent<infer Detail> ? Detail : never,
  ) {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail,
        bubbles: false,
      }),
    );
  }
}
