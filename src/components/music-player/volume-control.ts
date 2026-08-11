import type { TypedEvent } from "../../utils/types";

declare global {
  interface HTMLElementTagNameMap {
    "volume-control": VolumeControlElement;
  }

  interface GlobalEventHandlersEventMap {
    "volume-control:toggle": VolumeControlEvent<ToggleDetail>;
    "volume-control:seek": VolumeControlEvent<SeekDetail>;
  }
}

type VolumeControlEventMap = {
  "volume-control:toggle": CustomEvent<ToggleDetail>;
  "volume-control:seek": CustomEvent<SeekDetail>;
};

type VolumeControlEvent<Detail = unknown> = TypedEvent<VolumeControlElement, Detail>;

type ToggleDetail = {};
type SeekDetail = { volume: number };

export class VolumeControlElement extends HTMLElement {
  #trigger!: HTMLButtonElement;
  #triggerVolumeIcon!: HTMLSpanElement;
  #triggerMutedIcon!: HTMLSpanElement;

  #popup!: HTMLDivElement;
  #muteButton!: HTMLButtonElement;
  #popupVolumeIcon!: HTMLSpanElement;
  #popupMutedIcon!: HTMLSpanElement;
  #volumeBar!: HTMLInputElement;
  #popupVolumeText!: HTMLSpanElement;

  connectedCallback() {
    this.#trigger = this.querySelector(".trigger")!;
    this.#triggerVolumeIcon = this.#trigger.querySelector(".volume-icon")!;
    this.#triggerMutedIcon = this.#trigger.querySelector(".muted-icon")!;

    this.#popup = this.querySelector(".popup")!;
    this.#muteButton = this.#popup.querySelector(".mute-button")!;
    this.#popupVolumeIcon = this.#muteButton.querySelector(".volume-icon")!;
    this.#popupMutedIcon = this.#muteButton.querySelector(".muted-icon")!;
    this.#volumeBar = this.#popup.querySelector(".volume-bar")!;
    this.#popupVolumeText = this.#popup.querySelector(".volume-text")!;

    this.#popup.addEventListener("beforetoggle", (e: Event) => {
      const toggleEvent = e as ToggleEvent;
      if (toggleEvent.newState === "open") {
        const rect = this.#trigger.getBoundingClientRect();
        this.#popup.style.position = "fixed";
        this.#popup.style.bottom = `${window.innerHeight - rect.top + 8}px`;
        this.#popup.style.left = `${rect.left + rect.width / 2}px`;
        this.#popup.style.transform = "translateX(-50%)";
        this.#popup.style.right = "auto";
      }
    });

    this.#muteButton.addEventListener("click", () => {
      this.#dispatchEvent("volume-control:toggle", {});
    });

    this.#volumeBar.addEventListener("input", (e) => {
      const input = e.currentTarget as HTMLInputElement;
      const value = Number(input.value);
      this.#dispatchEvent("volume-control:seek", { volume: value });
    });
  }

  get volume() {
    return Number(this.#volumeBar.value);
  }

  set volume(volume: number) {
    const volumeValue = volume.toString();
    this.#volumeBar.value = volumeValue;
    this.#popupVolumeText.textContent = volumeValue;
  }

  get min() {
    return Number(this.#volumeBar.min);
  }

  get max() {
    return Number(this.#volumeBar.max);
  }

  set muted(muted: boolean) {
    if (muted) {
      this.#triggerVolumeIcon.hidden = true;
      this.#triggerMutedIcon.hidden = false;
      this.#popupVolumeIcon.hidden = true;
      this.#popupMutedIcon.hidden = false;
    } else {
      this.#triggerVolumeIcon.hidden = false;
      this.#triggerMutedIcon.hidden = true;
      this.#popupVolumeIcon.hidden = false;
      this.#popupMutedIcon.hidden = true;
    }
  }

  #dispatchEvent<Type extends keyof VolumeControlEventMap>(
    type: Type,
    detail: VolumeControlEventMap[Type] extends CustomEvent<infer Detail> ? Detail : never,
  ) {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail,
        bubbles: false,
      }),
    );
  }
}
