import { formatSec } from "../../utils/format";
import type { PlayControlEventMap } from "../../types/custom-elements";

export class PlayControlElement extends HTMLElement {
  #playPause!: HTMLButtonElement;
  #playIcon!: HTMLSpanElement;
  #pauseIcon!: HTMLSpanElement;
  #seekBar!: HTMLInputElement;
  #currentTime!: HTMLSpanElement;
  #durationDisplay!: HTMLSpanElement;

  #durationValue = 0;
  #isUserSeeking = false;

  connectedCallback() {
    this.#playPause = this.querySelector(".play-pause")!;
    this.#playIcon = this.#playPause.querySelector(".play-icon")!;
    this.#pauseIcon = this.#playPause.querySelector(".pause-icon")!;
    this.#seekBar = this.querySelector(".seek-bar")!;
    this.#currentTime = this.querySelector(".current-time")!;
    this.#durationDisplay = this.querySelector(".duration")!;

    this.#playPause.addEventListener("click", () => {
      this.#dispatchEvent("play-control:toggle", {});
    });

    this.#seekBar.addEventListener("change", (e) => {
      const input = e.currentTarget as HTMLInputElement;
      const second = Number(input.value);
      this.#dispatchEvent("play-control:seek", { second });
    });

    this.#seekBar.addEventListener("mousedown", this.#startSeek);
    this.#seekBar.addEventListener("mouseup", this.#endSeek);
    this.#seekBar.addEventListener("touchstart", this.#startSeek, { passive: true });
    this.#seekBar.addEventListener("touchend", this.#endSeek);
  }

  get time() {
    return Number(this.#seekBar.value);
  }

  set time(second: number) {
    const text = formatSec(second);
    if (this.#currentTime.textContent !== text) {
      this.#currentTime.textContent = text;
    }
    if (this.#durationValue && !this.#isUserSeeking) {
      this.#seekBar.value = second.toFixed(3);
    }
  }

  set duration(durationSecs: number) {
    this.#seekBar.max = durationSecs.toString();
    this.#durationValue = durationSecs;
    const text = formatSec(durationSecs);
    this.#durationDisplay.textContent = text;
  }

  get min() {
    return Number(this.#seekBar.min);
  }

  get max() {
    return Number(this.#seekBar.max);
  }

  set state(state: "playing" | "paused") {
    switch (state) {
      case "playing":
        this.#toPlaying();
        break;
      case "paused":
        this.#toPaused();
        break;
      default:
        state satisfies never;
    }
  }

  #toPlaying() {
    this.#playIcon.hidden = true;
    this.#pauseIcon.hidden = false;
  }

  #toPaused() {
    this.#playIcon.hidden = false;
    this.#pauseIcon.hidden = true;
  }

  #startSeek = () => {
    this.#isUserSeeking = true;
  };

  #endSeek = () => {
    this.#isUserSeeking = false;
  };

  #dispatchEvent<Type extends keyof PlayControlEventMap>(
    type: Type,
    detail: PlayControlEventMap[Type] extends CustomEvent<infer Detail> ? Detail : never,
  ) {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail,
        bubbles: false,
      }),
    );
  }
}
