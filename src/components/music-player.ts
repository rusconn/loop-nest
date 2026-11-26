import { Music } from "../domain/music";
import type { MusicHandle } from "../domain/music-handle";
import { PlaybackPosition } from "../domain/playback-position";
import { AudioPlayer, type LoadResult } from "../lib/audio-player";
import { MusicSettingsStorage } from "../storage/music/settings";
import {
  ShortcutKeyHandler,
  type ShortcutKeyHandlerEventMap,
} from "./music-player/_helpers/shortcut-key-handler";
import type { MediaSessionElement } from "./music-player/media-session";
import type { PlayControlElement } from "./music-player/play-control";
import type { VolumeControlElement } from "./music-player/volume-control";
import type { TempoControlElement } from "./music-player/tempo-control";
import { dispatchTypedEvent } from "../utils/event";

export class MusicPlayerElement extends HTMLElement {
  #mediaSession!: MediaSessionElement;
  #playControl!: PlayControlElement;
  #volumeControl!: VolumeControlElement;
  #tempoControl!: TempoControlElement;
  #controlsFieldset!: HTMLFieldSetElement;
  #shortcutKey!: ShortcutKeyHandler;

  #audioPlayer = new AudioPlayer();
  #loadedMusic: Music | undefined;
  #updateDisplayRequestId = 0;
  #framesUntilUpdate = 0;

  connectedCallback() {
    this.#setupMediaSession();
    this.#setupControlsFieldset();
    this.#setupPlayControl();
    this.#setupVolumeControl();
    this.#setupTempoControl();
    this.#setupShortcutKey();
  }

  #setupMediaSession() {
    this.#mediaSession = this.querySelector("media-session")!;
    this.#mediaSession.setActionHandler("play", async () => {
      await this.play();
    });
    this.#mediaSession.setActionHandler("pause", async () => {
      await this.pause();
    });
  }

  #setupControlsFieldset() {
    this.#controlsFieldset = this.querySelector("fieldset")!;
  }

  #setupPlayControl() {
    this.#playControl = this.querySelector("play-control")!;
    this.#playControl.addEventListener("play-control:toggle", async () => {
      await this.togglePlaying();
    });
    this.#playControl.addEventListener("play-control:seek", async (e) => {
      await this.seekTo(e.detail.second);
    });
  }

  #setupVolumeControl() {
    this.#volumeControl = this.querySelector("volume-control")!;
    this.#volumeControl.addEventListener("volume-control:toggle", () => {
      this.toggleMute();
    });
    this.#volumeControl.addEventListener("volume-control:seek", (e) => {
      this.volume = e.detail.volume;
    });
  }

  #setupTempoControl() {
    this.#tempoControl = this.querySelector("tempo-control")!;
    this.#tempoControl.addEventListener("tempo-control:reset", () => {
      this.tempo = 1;
    });
    this.#tempoControl.addEventListener("tempo-control:seek", (e) => {
      this.tempo = e.detail.tempo;
    });
  }

  #setupShortcutKey() {
    this.#shortcutKey = new ShortcutKeyHandler();
    this.#shortcutKey.addEventListener("shortcut-key-handler:toggle-playing", async () => {
      await this.togglePlaying();
    });
    this.#shortcutKey.addEventListener("shortcut-key-handler:toggle-mute", () => {
      this.toggleMute();
    });
    this.#shortcutKey.addEventListener("shortcut-key-handler:seek", async (e) => {
      const ev = e as ShortcutKeyHandlerEventMap["shortcut-key-handler:seek"];
      await this.seekBy(ev.detail.delta);
    });
    this.#shortcutKey.addEventListener("shortcut-key-handler:change-volume", (e) => {
      const ev = e as ShortcutKeyHandlerEventMap["shortcut-key-handler:change-volume"];
      this.changeVolume(ev.detail.delta);
    });
    this.#shortcutKey.addEventListener("shortcut-key-handler:change-tempo", (e) => {
      const ev = e as ShortcutKeyHandlerEventMap["shortcut-key-handler:change-tempo"];
      this.changeTempo(ev.detail.delta);
    });
    this.#shortcutKey.register();
  }

  disconnectedCallback() {
    this.#unsetShortcutKey();
  }

  #unsetShortcutKey() {
    this.#shortcutKey.unregister();
  }

  async load(handle: MusicHandle) {
    if (this.hasAttribute("inert")) return;
    this.setAttribute("inert", "");

    const { id, metadata } = handle;

    dispatchTypedEvent(this, "music-player:start-loading", { id });
    this.#pauseUI();

    let buffer: ArrayBuffer;
    try {
      buffer = await handle.file.arrayBuffer();
    } catch (cause) {
      console.error(cause, id);
      alert("Sorry, failed to load the music file.\nThe file may have been moved or deleted.");
      dispatchTypedEvent(this, "music-player:fail-loading", { id });
      this.removeAttribute("inert");
      return;
    }

    const { format, loopInfo } = metadata;
    const { duration } = format;
    const settings = this.#resolveSettings(id);

    console.log(loopInfo ?? "none");

    let result: LoadResult;
    try {
      result = await this.#audioPlayer.load(buffer, duration, {
        ...settings,
        loop: loopInfo ?? true,
      });
    } catch (cause) {
      // unexpected exception
      console.error(cause, id);
      dispatchTypedEvent(this, "music-player:fail-loading", { id });
      this.removeAttribute("inert");
      return;
    }

    this.removeAttribute("inert");

    switch (result.type) {
      case "success": {
        const music = Music.create(id, metadata, settings);
        this.#loadToUI(music);
        this.#loadToMediaSession(music);
        this.#loadedMusic = music;
        dispatchTypedEvent(this, "music-player:complete-loading", { id });
        break;
      }
      case "failed":
        console.error(result.cause);
        alert("Sorry, failed to load the music file.\nTry another browser.");
        dispatchTypedEvent(this, "music-player:fail-loading", { id });
        break;
      case "unsupported":
        console.error("unsupported operation");
        dispatchTypedEvent(this, "music-player:fail-loading", { id });
        break;
      default:
        result satisfies never;
    }
  }

  #resolveSettings(id: Music["id"]): Music["settings"] {
    try {
      return MusicSettingsStorage.get(id) ?? Music.Settings.create();
    } catch (cause) {
      console.error(cause, id);
      return Music.Settings.create();
    }
  }

  set volume(volume: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const settings = Music.Settings.withVolume(this.#loadedMusic.settings, volume);
    this.#applyVolume(settings);
  }

  changeVolume(delta: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const settings = Music.Settings.changeVolume(this.#loadedMusic.settings, delta);
    this.#applyVolume(settings);
  }

  #applyVolume(settings: Music["settings"]) {
    if (!this.#loadedMusic) return;
    this.#audioPlayer.volume = settings.volume;
    this.#volumeControl.volume = settings.volume;
    this.#loadedMusic.settings = settings;
    MusicSettingsStorage.upsert(this.#loadedMusic.id, settings);
  }

  set tempo(tempo: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const settings = Music.Settings.withTempo(this.#loadedMusic.settings, tempo);
    this.#applyTempo(settings);
  }

  changeTempo(delta: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const settings = Music.Settings.changeTempo(this.#loadedMusic.settings, delta);
    this.#applyTempo(settings);
  }

  #applyTempo(settings: Music["settings"]) {
    if (!this.#loadedMusic) return;
    this.#audioPlayer.tempo = settings.tempo;
    this.#tempoControl.tempo = settings.tempo;
    this.#loadedMusic.settings = settings;
    MusicSettingsStorage.upsert(this.#loadedMusic.id, settings);
  }

  async play() {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const result = await this.#audioPlayer.play();
    switch (result.type) {
      case "success":
        dispatchTypedEvent(this, "music-player:play", { music: this.#loadedMusic });
        this.#renderForPlay();
        break;
      case "unsupported":
        console.error("unsupported operation");
        break;
      default:
        result satisfies never;
    }
  }

  #renderForPlay() {
    this.#playControl.state = "playing";
    this.#mediaSession.playbackState = "playing";
    this.#startUpdateCurrentTime();
  }

  async pause() {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const result = await this.#audioPlayer.pause();
    switch (result.type) {
      case "success":
        dispatchTypedEvent(this, "music-player:pause", { music: this.#loadedMusic });
        this.#renderForPause();
        break;
      case "unsupported":
        console.error("unsupported operation");
        break;
      default:
        result satisfies never;
    }
  }

  #renderForPause() {
    this.#playControl.state = "paused";
    this.#mediaSession.playbackState = "paused";
    this.#stopUpdateCurrentTime();
  }

  async togglePlaying() {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const result = await this.#audioPlayer.togglePlaying();
    switch (result.type) {
      case "success": {
        const eventType = result.current === "paused" ? "music-player:pause" : "music-player:play";
        dispatchTypedEvent(this, eventType, { music: this.#loadedMusic });
        this.#renderForTogglePlaying(result.current);
        break;
      }
      case "unsupported":
        console.error("unsupported operation");
        break;
      default:
        result satisfies never;
    }
  }

  #renderForTogglePlaying(current: "paused" | "playing") {
    switch (current) {
      case "paused":
        this.#renderForPause();
        break;
      case "playing":
        this.#renderForPlay();
        break;
      default:
        current satisfies never;
    }
  }

  async seekTo(sec: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const duration = this.#loadedMusic.metadata.format.duration;
    const position = PlaybackPosition.clamp(sec, duration);
    await this.#seek(position);
  }

  async seekBy(delta: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const currentTime = this.#audioPlayer.currentTime ?? 0;
    const duration = this.#loadedMusic.metadata.format.duration;
    const position = PlaybackPosition.shift(currentTime, delta, duration);
    await this.#seek(position);
  }

  async #seek(position: PlaybackPosition) {
    const result = await this.#audioPlayer.seekTo(position);
    switch (result.type) {
      case "success":
        this.#playControl.time = this.#audioPlayer.currentTime ?? 0;
        break;
      case "unsupported":
        console.error("unsupported operation");
        break;
      default:
        result satisfies never;
    }
  }

  toggleMute() {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const result = this.#audioPlayer.toggleMute();
    switch (result.type) {
      case "success":
        this.#volumeControl.muted = result.current === "muted";
        break;
      case "unsupported":
        console.error("unsupported operation");
        break;
      default:
        result satisfies never;
    }
  }

  // helpers

  #pauseUI() {
    this.#playControl.state = "paused";
    this.#stopUpdateCurrentTime();
  }

  #loadToUI(music: Pick<Music, "metadata" | "settings">) {
    const { metadata, settings } = music;
    const { format } = metadata;

    this.#playControl.duration = format.duration;
    this.#playControl.time = 0;
    this.#volumeControl.volume = settings.volume;
    this.#tempoControl.tempo = settings.tempo;
    this.#controlsFieldset.disabled = false;
  }

  #loadToMediaSession(music: Pick<Music, "metadata">) {
    this.#mediaSession.loadMetadata(music.metadata.common);
  }

  #startUpdateCurrentTime() {
    this.#updateDisplayRequestId = requestAnimationFrame(this.#updateCurrentTime);
  }

  #stopUpdateCurrentTime() {
    cancelAnimationFrame(this.#updateDisplayRequestId);
  }

  #updateCurrentTime = () => {
    if (--this.#framesUntilUpdate <= 0) {
      this.#framesUntilUpdate = 3;
      this.#playControl.time = this.#audioPlayer.currentTime ?? 0;
    }
    this.#updateDisplayRequestId = requestAnimationFrame(this.#updateCurrentTime);
  };
}
