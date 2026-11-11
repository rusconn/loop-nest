import { dispatchTypedEvent } from "../utils/event";

export class MusicUploaderElement extends HTMLElement {
  #musicInput!: HTMLInputElement;
  #musicUpload!: HTMLButtonElement;

  connectedCallback() {
    this.#musicInput = this.querySelector("input")!;
    this.#musicUpload = this.querySelector("button")!;

    this.#musicInput.addEventListener("change", (e) => {
      const input = e.currentTarget as HTMLInputElement;
      if (input.files) {
        dispatchTypedEvent(this, "music-uploader:upload-files", { files: input.files });
        input.value = ""; // clear selection
      }
    });

    this.#musicUpload.addEventListener("click", (e) => {
      e.stopPropagation();
      this.#musicInput.click();
    });
  }
}
