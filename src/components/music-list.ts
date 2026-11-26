import { Music } from "../domain/music";
import { MusicHandle } from "../domain/music-handle";
import { MusicMetadataStorage } from "../storage/music/metadata";
import { dispatchTypedEvent } from "../utils/event";
import { formatSec } from "../utils/format";

export class MusicListElement extends HTMLElement {
  #ul!: HTMLUListElement;
  #liTemplate!: HTMLTemplateElement;

  #loadedId: Music["id"] | undefined;

  connectedCallback() {
    this.#ul = this.querySelector("ul")!;
    this.#liTemplate = this.querySelector("template")!;
  }

  async add(files: FileList) {
    const willMaybeLiFragments = [...files].map(this.#toWillMaybeLiFragment.bind(this));
    const maybeLiFragments = await Promise.all(willMaybeLiFragments);
    const liFragments = maybeLiFragments.filter((mlif) => mlif != null);
    this.#ul.prepend(...liFragments);
  }

  async #toWillMaybeLiFragment(file: File) {
    const id = Music.Id.create(file);

    const savedMetadata = MusicMetadataStorage.get(id);
    const isOldMetadata = (savedMetadata?.version ?? Infinity) < Music.Metadata.CURRENT_VERSION;

    if (savedMetadata != null && !isOldMetadata) {
      return this.#buildLiFragment(id, savedMetadata, file);
    }

    const buffer = await file.arrayBuffer();
    const result = await Music.Metadata.parse(buffer, file.type, file.name);

    // TODO: make some announcement
    switch (result.kind) {
      case "ok": {
        if (savedMetadata == null || isOldMetadata) {
          MusicMetadataStorage.set(id, result.metadata);
        }
        return this.#buildLiFragment(id, result.metadata, file);
      }
      case "invalid-loop":
        console.error(result.message, file.name);
        break;
      case "unreadable":
        console.error(result.cause, file.name);
        break;
      case "no-duration":
        console.error("failed to parse duration", file.name);
        break;
      default:
        throw new Error(result satisfies never);
    }
  }

  #buildLiFragment(id: Music["id"], metadata: Music["metadata"], file: File) {
    const liFragment = this.#liTemplate.content.cloneNode(true) as DocumentFragment;
    const li = liFragment.firstElementChild!;
    const [_, button] = li.children;
    const [title, duration] = button.children;

    const handle = MusicHandle.create(id, metadata, file);

    button.addEventListener("click", () => {
      dispatchTypedEvent(this, "music-list:select", { handle });
    });

    const { common, format } = metadata;

    title.textContent = common.title;
    duration.textContent = formatSec(format.duration);

    liFragment.firstElementChild!.setAttribute("data-id", handle.id);

    return liFragment;
  }

  startLoading(id: Music["id"]) {
    this.#ul.setAttribute("inert", "");

    if (this.#loadedId) {
      const loaded = this.#queryLoadedIndicator(this.#loadedId);
      if (loaded) {
        loaded.hidden = true;
      }
    }

    const loading = this.#queryLoadingIndicator(id);
    if (loading) {
      loading.hidden = false;
    }
  }

  completeLoading(id: Music["id"]) {
    const loading = this.#queryLoadingIndicator(id);
    if (loading) {
      loading.hidden = true;
    }

    const loaded = this.#queryLoadedIndicator(id);
    if (loaded) {
      loaded.hidden = false;
    }

    this.#loadedId = id;

    this.#ul.removeAttribute("inert");
  }

  failLoading(id: Music["id"]) {
    const loading = this.#queryLoadingIndicator(id);
    if (loading) {
      loading.hidden = true;
    }

    alert("Sorry, failed to load the music file.\nTry another browser.");
    this.#ul.removeAttribute("inert");
  }

  #queryLoadingIndicator(id: Music["id"]) {
    return this.#queryRow(id)?.querySelector<HTMLElement>(".loading-indicator");
  }

  #queryLoadedIndicator(id: Music["id"]) {
    return this.#queryRow(id)?.querySelector<HTMLElement>(".loaded-indicator");
  }

  #queryRow(id: Music["id"]) {
    return this.querySelector(`li[data-id="${id.replaceAll('"', '\\"')}"]`);
  }
}
