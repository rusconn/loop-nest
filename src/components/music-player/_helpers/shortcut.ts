type Shortcut =
  | "toggle-playing"
  | "toggle-mute"
  | "seek-backward"
  | "seek-forward"
  | "down-volume"
  | "up-volume"
  | "down-tempo"
  | "up-tempo";

type KeyAsString = `${Shift}-${Meta}-${string}`;
type Shift = boolean;
type Meta = boolean;

const keyStringShortcutMap: Record<KeyAsString, Shortcut> = {
  "false-false- ": "toggle-playing",
  "false-false-p": "toggle-playing",
  "false-false-m": "toggle-mute",
  "false-false-ArrowLeft": "seek-backward",
  "false-false-ArrowRight": "seek-forward",
  "false-true-ArrowDown": "down-volume",
  "false-true-ArrowUp": "up-volume",
  "true-false-ArrowDown": "down-tempo",
  "true-false-ArrowUp": "up-tempo",
};

export const Shortcut = {
  parse(e: KeyboardEvent): Shortcut | undefined {
    return keyStringShortcutMap[keyString(e)];
  },
};

function keyString(e: KeyboardEvent): KeyAsString {
  return `${e.shiftKey}-${e.metaKey}-${e.key}`;
}
