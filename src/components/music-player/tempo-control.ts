import type { TypedEvent } from "../../utils/types";

declare global {
  interface HTMLElementTagNameMap {
    "tempo-control": TempoControlElement;
  }

  interface GlobalEventHandlersEventMap {
    "tempo-control:reset": TempoControlEvent<ResetDetail>;
    "tempo-control:seek": TempoControlEvent<SeekDetail>;
  }
}

type TempoControlEventMap = {
  "tempo-control:reset": CustomEvent<ResetDetail>;
  "tempo-control:seek": CustomEvent<SeekDetail>;
};

type TempoControlEvent<Detail = unknown> = TypedEvent<TempoControlElement, Detail>;

type ResetDetail = {};
type SeekDetail = { tempo: number };

export class TempoControlElement extends HTMLElement {
  #trigger!: HTMLButtonElement;

  #popup!: HTMLDivElement;
  #tempoButton!: HTMLButtonElement;
  #tempoBar!: HTMLInputElement;
  #popupTempoText!: HTMLSpanElement;

  connectedCallback() {
    this.#trigger = this.querySelector(".trigger")!;

    this.#popup = this.querySelector(".popup")!;
    this.#tempoButton = this.#popup.querySelector(".tempo-button")!;
    this.#tempoBar = this.#popup.querySelector(".tempo-bar")!;
    this.#popupTempoText = this.#popup.querySelector(".tempo-text")!;

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

    this.#tempoButton.addEventListener("click", () => {
      this.#dispatchEvent("tempo-control:reset", {});
    });

    this.#tempoBar.addEventListener("input", (e) => {
      const input = e.currentTarget as HTMLInputElement;
      const value = Number(input.value);
      this.#dispatchEvent("tempo-control:seek", { tempo: value });
    });
  }

  get tempo() {
    return Number(this.#tempoBar.value);
  }

  set tempo(tempo: number) {
    const tempoValue = tempo.toFixed(2);
    this.#tempoBar.value = tempoValue;
    this.#popupTempoText.textContent = tempoValue;
  }

  get min() {
    return Number(this.#tempoBar.min);
  }

  get max() {
    return Number(this.#tempoBar.max);
  }

  #dispatchEvent<Type extends keyof TempoControlEventMap>(
    type: Type,
    detail: TempoControlEventMap[Type] extends CustomEvent<infer Detail> ? Detail : never,
  ) {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail,
        bubbles: false,
      }),
    );
  }
}
