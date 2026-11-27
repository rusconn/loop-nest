import { dispatchTypedEvent } from "../../utils/event";

export class TempoControlElement extends HTMLElement {
  #tempoButton!: HTMLButtonElement;
  #tempoBar!: HTMLInputElement;
  #popupTempoText!: HTMLSpanElement;

  connectedCallback() {
    const popup = this.querySelector(".popup")!;
    this.#tempoButton = popup.querySelector(".tempo-button")!;
    this.#tempoBar = popup.querySelector(".tempo-bar")!;
    this.#popupTempoText = popup.querySelector(".tempo-text")!;

    this.#tempoButton.addEventListener("click", () => {
      dispatchTypedEvent(this, "tempo-control:reset", {});
    });

    this.#tempoBar.addEventListener("input", (e) => {
      const input = e.currentTarget as HTMLInputElement;
      const value = Number(input.value);
      dispatchTypedEvent(this, "tempo-control:seek", { tempo: value });
    });
  }

  set tempo(tempo: number) {
    const tempoValue = tempo.toFixed(2);
    this.#tempoBar.value = tempoValue;
    this.#popupTempoText.textContent = tempoValue;
  }
}
