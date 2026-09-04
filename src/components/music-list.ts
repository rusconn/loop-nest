import { Music, CURRENT_METADATA_VERSION } from "../models/music";
import { MusicMetadataStorage } from "../storage/music/metadata";
import { MusicSettingsStorage } from "../storage/music/settings";
import { formatSec } from "../utils/format";
import type { TypedEvent } from "../utils/types";

declare global {
  interface HTMLElementTagNameMap {
    "music-list": MusicListElement;
  }

  interface GlobalEventHandlersEventMap {
    "music-list:select": MusicListEvent<SelectDetail>;
  }
}

type MusicListEventMap = {
  "music-list:select": CustomEvent<SelectDetail>;
};

type MusicListEvent<Detail = unknown> = TypedEvent<MusicListElement, Detail>;

type SelectDetail = { music: Music };

export class MusicListElement extends HTMLElement {
  #ul!: HTMLUListElement;
  #liTemplate!: HTMLTemplateElement;

  #loadedMusic: Music | undefined;

  connectedCallback() {
    this.#ul = this.querySelector("ul")!;
    this.#liTemplate = this.querySelector("template")!;
  }

  async add(files: FileList) {
    const willMaybeLiFragments = [...files].map(this.#toWillMaybeLiFragment.bind(this));
    const maybeLiFragments = await Promise.all(willMaybeLiFragments);
    const liFragments = maybeLiFragments.filter((mlif) => !!mlif);
    this.#ul.prepend(...liFragments);
  }

  async #toWillMaybeLiFragment(file: File) {
    const buffer = await file.arrayBuffer();
    const id = await Music.id(buffer);

    const savedMetadata = MusicMetadataStorage.get(id);
    const savedSettings = MusicSettingsStorage.get(id);
    const isOldMetadata = savedMetadata != null && savedMetadata.version < CURRENT_METADATA_VERSION;

    if (savedMetadata && savedSettings && !isOldMetadata) {
      const music = { id, file, metadata: savedMetadata, settings: savedSettings };
      return this.#buildLiFragment(music);
    }

    const result = await Music.parse(id, buffer, file);

    // TODO: make some announcement
    switch (result.kind) {
      case "ok": {
        const { music } = result;
        if (!savedMetadata || isOldMetadata) {
          MusicMetadataStorage.set(id, music.metadata);
        }
        if (!savedSettings) {
          MusicSettingsStorage.set(id, music.settings);
        }
        return this.#buildLiFragment(music);
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

  #buildLiFragment(music: Music) {
    const liFragment = this.#liTemplate.content.cloneNode(true) as DocumentFragment;
    const li = liFragment.firstElementChild!;
    const [_, button] = li.children;
    const [title, duration] = button.children;

    button.addEventListener("click", () => {
      this.#dispatchEvent("music-list:select", { music });
    });

    const { common, format } = music.metadata;

    title.textContent = common.title;
    duration.textContent = formatSec(format.duration);

    liFragment.firstElementChild!.setAttribute("data-id", music.id);

    return liFragment;
  }

  startLoading(music: Music) {
    this.#ul.setAttribute("inert", "");

    if (this.#loadedMusic) {
      const loaded = this.#queryLoadedIndicator(this.#loadedMusic);
      if (loaded) {
        loaded.hidden = true;
      }
    }

    const loading = this.#queryLoadingIndicator(music);
    if (loading) {
      loading.hidden = false;
    }
  }

  completeLoading(music: Music) {
    const loading = this.#queryLoadingIndicator(music);
    if (loading) {
      loading.hidden = true;
    }

    const loaded = this.#queryLoadedIndicator(music);
    if (loaded) {
      loaded.hidden = false;
    }

    this.#loadedMusic = music;

    this.#ul.removeAttribute("inert");
  }

  failLoading(music: Music) {
    const loading = this.#queryLoadingIndicator(music);
    if (loading) {
      loading.hidden = true;
    }

    alert("Sorry, failed to load the music file.\nTry another browser.");
    this.#ul.removeAttribute("inert");
  }

  #queryLoadingIndicator(music: Music) {
    return this.#queryRow(music)?.querySelector<HTMLElement>(".loading-indicator");
  }

  #queryLoadedIndicator(music: Music) {
    return this.#queryRow(music)?.querySelector<HTMLElement>(".loaded-indicator");
  }

  #queryRow(music: Music) {
    return this.querySelector(`li[data-id=${music.id}]`);
  }

  #dispatchEvent<Type extends keyof MusicListEventMap>(
    type: Type,
    detail: MusicListEventMap[Type] extends CustomEvent<infer Detail> ? Detail : never,
  ) {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail,
        bubbles: false,
      }),
    );
  }
}
