import { formatSec } from "../../utils/format";
import { dispatchTypedEvent } from "../../utils/event";

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
      dispatchTypedEvent(this, "play-control:toggle", {});
    });

    this.#seekBar.addEventListener("change", (e) => {
      const input = e.currentTarget as HTMLInputElement;
      const second = Number(input.value);
      dispatchTypedEvent(this, "play-control:seek", { second });
    });

    this.#seekBar.addEventListener("mousedown", this.#startSeek);
    this.#seekBar.addEventListener("mouseup", this.#endSeek);
    this.#seekBar.addEventListener("touchstart", this.#startSeek, { passive: true });
    this.#seekBar.addEventListener("touchend", this.#endSeek);
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

  set state(state: "playing" | "paused") {
    switch (state) {
      case "playing":
        this.#playIcon.hidden = true;
        this.#pauseIcon.hidden = false;
        break;
      case "paused":
        this.#playIcon.hidden = false;
        this.#pauseIcon.hidden = true;
        break;
      default:
        state satisfies never;
    }
  }

  #startSeek = () => {
    this.#isUserSeeking = true;
  };

  #endSeek = () => {
    this.#isUserSeeking = false;
  };
}
