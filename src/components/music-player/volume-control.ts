import { dispatchTypedEvent } from "../../utils/event";

export class VolumeControlElement extends HTMLElement {
  #triggerVolumeIcon!: HTMLSpanElement;
  #triggerMutedIcon!: HTMLSpanElement;

  #muteButton!: HTMLButtonElement;
  #popupVolumeIcon!: HTMLSpanElement;
  #popupMutedIcon!: HTMLSpanElement;
  #volumeBar!: HTMLInputElement;
  #popupVolumeText!: HTMLSpanElement;

  connectedCallback() {
    const trigger = this.querySelector(".trigger")!;
    this.#triggerVolumeIcon = trigger.querySelector(".volume-icon")!;
    this.#triggerMutedIcon = trigger.querySelector(".muted-icon")!;

    const popup = this.querySelector(".popup")!;
    this.#muteButton = popup.querySelector(".mute-button")!;
    this.#popupVolumeIcon = this.#muteButton.querySelector(".volume-icon")!;
    this.#popupMutedIcon = this.#muteButton.querySelector(".muted-icon")!;
    this.#volumeBar = popup.querySelector(".volume-bar")!;
    this.#popupVolumeText = popup.querySelector(".volume-text")!;

    this.#muteButton.addEventListener("click", () => {
      dispatchTypedEvent(this, "volume-control:toggle", {});
    });

    this.#volumeBar.addEventListener("input", (e) => {
      const input = e.currentTarget as HTMLInputElement;
      const value = Number(input.value) / 100;
      dispatchTypedEvent(this, "volume-control:seek", { volume: value });
    });
  }

  set volume(volume: number) {
    const volumeValue = Math.round(volume * 100).toString();
    this.#volumeBar.value = volumeValue;
    this.#popupVolumeText.textContent = volumeValue;
  }

  set muted(muted: boolean) {
    this.#triggerVolumeIcon.hidden = muted;
    this.#triggerMutedIcon.hidden = !muted;
    this.#popupVolumeIcon.hidden = muted;
    this.#popupMutedIcon.hidden = !muted;
  }
}
