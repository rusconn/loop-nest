import { Music } from "../models/music";
import { MusicHandle } from "../models/music-handle";
import { MusicMetadataStorage } from "../storage/music/metadata";
import { MusicSettingsStorage } from "../storage/music/settings";
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
    const buffer = await file.arrayBuffer();
    const id = await Music.Id.create(buffer);

    const savedMetadata = MusicMetadataStorage.get(id);
    const savedSettings = MusicSettingsStorage.get(id);
    const isOldMetadata =
      savedMetadata != null && savedMetadata.version < Music.Metadata.CURRENT_VERSION;

    if (savedMetadata && savedSettings && !isOldMetadata) {
      return this.#buildLiFragment(id, savedMetadata, savedSettings, file);
    }

    const metadata = await Music.Metadata.parse(buffer, file.type, file.name);
    const settings = Music.Settings.create();

    // TODO: make some announcement
    switch (metadata.kind) {
      case "ok": {
        if (savedMetadata == null || isOldMetadata) {
          MusicMetadataStorage.set(id, metadata.metadata);
        }
        if (savedSettings == null) {
          MusicSettingsStorage.set(id, settings);
        }
        return this.#buildLiFragment(id, metadata.metadata, settings, file);
      }
      case "invalid-loop":
        console.error(metadata.message, file.name);
        break;
      case "unreadable":
        console.error(metadata.cause, file.name);
        break;
      case "no-duration":
        console.error("failed to parse duration", file.name);
        break;
      default:
        throw new Error(metadata satisfies never);
    }
  }

  #buildLiFragment(
    id: Music["id"],
    metadata: Music["metadata"],
    settings: Music["settings"],
    file: File,
  ) {
    const liFragment = this.#liTemplate.content.cloneNode(true) as DocumentFragment;
    const li = liFragment.firstElementChild!;
    const [_, button] = li.children;
    const [title, duration] = button.children;

    const handle = MusicHandle.create(id, metadata, settings, file);

    button.addEventListener("click", () => {
      dispatchTypedEvent(this, "music-list:select", { handle });
    });

    const { common, format } = metadata;

    title.textContent = common.title;
    duration.textContent = formatSec(format.duration);

    liFragment.firstElementChild!.setAttribute("data-id", handle.id);

    return liFragment;
  }

  startLoading(music: Music) {
    this.#ul.setAttribute("inert", "");

    if (this.#loadedId) {
      const loaded = this.#queryLoadedIndicator(this.#loadedId);
      if (loaded) {
        loaded.hidden = true;
      }
    }

    const loading = this.#queryLoadingIndicator(music.id);
    if (loading) {
      loading.hidden = false;
    }
  }

  completeLoading(music: Music) {
    const loading = this.#queryLoadingIndicator(music.id);
    if (loading) {
      loading.hidden = true;
    }

    const loaded = this.#queryLoadedIndicator(music.id);
    if (loaded) {
      loaded.hidden = false;
    }

    this.#loadedId = music.id;

    this.#ul.removeAttribute("inert");
  }

  failLoading(music: Music) {
    const loading = this.#queryLoadingIndicator(music.id);
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
    return this.querySelector(`li[data-id=${id}]`);
  }
}
