import { AudioPlayer } from "../lib/audio-player";
import * as Music from "../models/music";
import * as MusicSettingsStorage from "../storage/music/settings";
import type { TypedEvent } from "../utils/types";
import {
  ShortcutKeyHandler,
  type ShortcutKeyHandlerEventMap,
} from "./music-player/_helpers/shortcut-key-handler";
import type { MediaSessionElement } from "./music-player/media-session";
import type { PlayControlElement } from "./music-player/play-control";
import type { VolumeControlElement } from "./music-player/volume-control";
import type { TempoControlElement } from "./music-player/tempo-control";
import { clamp } from "../lib/math";

declare global {
  interface HTMLElementTagNameMap {
    "music-player": MusicPlayerElement;
  }

  interface GlobalEventHandlersEventMap {
    "music-player:play": MusicPlayerEvent<PlayDetail>;
    "music-player:pause": MusicPlayerEvent<PauseDetail>;
    "music-player:start-loading": MusicPlayerEvent<StartLoadingDetail>;
    "music-player:complete-loading": MusicPlayerEvent<CompleteLoadingDetail>;
    "music-player:fail-loading": MusicPlayerEvent<FailLoadingDetail>;
  }
}

type MusicPlayerEventMap = {
  "music-player:play": CustomEvent<PlayDetail>;
  "music-player:pause": CustomEvent<PauseDetail>;
  "music-player:start-loading": CustomEvent<StartLoadingDetail>;
  "music-player:complete-loading": CustomEvent<CompleteLoadingDetail>;
  "music-player:fail-loading": CustomEvent<FailLoadingDetail>;
};

type MusicPlayerEvent<Detail = unknown> = TypedEvent<MusicPlayerElement, Detail>;

type PlayDetail = { music: Music.Music };
type PauseDetail = { music: Music.Music };
type StartLoadingDetail = { music: Music.Music };
type CompleteLoadingDetail = { music: Music.Music };
type FailLoadingDetail = { music: Music.Music };

export class MusicPlayerElement extends HTMLElement {
  #mediaSession!: MediaSessionElement;
  #playControl!: PlayControlElement;
  #volumeControl!: VolumeControlElement;
  #tempoControl!: TempoControlElement;
  #controlsFieldset!: HTMLFieldSetElement;
  #shortcutKey!: ShortcutKeyHandler;

  #audioPlayer = new AudioPlayer();
  #loadedMusic: Music.Music | undefined;
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
      this.volume = e.detail.volume / 100;
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
    this.#shortcutKey.addEventListener("shortcut-key-handler:seek-backward", async (e) => {
      const ev = e as ShortcutKeyHandlerEventMap["shortcut-key-handler:seek-backward"];
      await this.seekBackward(ev.detail.secs);
    });
    this.#shortcutKey.addEventListener("shortcut-key-handler:seek-forward", async (e) => {
      const ev = e as ShortcutKeyHandlerEventMap["shortcut-key-handler:seek-forward"];
      await this.seekForward(ev.detail.secs);
    });
    this.#shortcutKey.addEventListener("shortcut-key-handler:down-volume", (e) => {
      const ev = e as ShortcutKeyHandlerEventMap["shortcut-key-handler:down-volume"];
      this.downVolume(ev.detail.amount);
    });
    this.#shortcutKey.addEventListener("shortcut-key-handler:up-volume", (e) => {
      const ev = e as ShortcutKeyHandlerEventMap["shortcut-key-handler:up-volume"];
      this.upVolume(ev.detail.amount);
    });
    this.#shortcutKey.addEventListener("shortcut-key-handler:down-tempo", (e) => {
      const ev = e as ShortcutKeyHandlerEventMap["shortcut-key-handler:down-tempo"];
      this.downTempo(ev.detail.amount);
    });
    this.#shortcutKey.addEventListener("shortcut-key-handler:up-tempo", (e) => {
      const ev = e as ShortcutKeyHandlerEventMap["shortcut-key-handler:up-tempo"];
      this.upTempo(ev.detail.amount);
    });
    this.#shortcutKey.register();
  }

  disconnectedCallback() {
    this.#unsetShortcutKey();
  }

  #unsetShortcutKey() {
    this.#shortcutKey.unregister();
  }

  async load(music: Music.Music) {
    this.#dispatchEvent("music-player:start-loading", { music });

    this.setAttribute("inert", "");
    this.#pauseUI();

    const { file, metadata } = music;
    const { format, loopInfo } = metadata;
    const { duration } = format;
    const musicBytes = await file.arrayBuffer();

    console.log(loopInfo ?? "none");

    const result = await this.#audioPlayer.load(musicBytes, duration, {
      ...music.settings,
      loop: loopInfo ?? true,
    });

    this.removeAttribute("inert");

    switch (result.type) {
      case "success":
        this.#loadToUI(music);
        this.#loadToMediaSession(music);
        this.#loadedMusic = music;
        this.#dispatchEvent("music-player:complete-loading", { music });
        break;
      case "failed":
        console.error(result.cause);
        this.#dispatchEvent("music-player:fail-loading", { music });
        break;
      case "unsupported":
        console.error("unsupported operation");
        break;
      default:
        result satisfies never;
    }
  }

  set volume(volume: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    this.#audioPlayer.volume = volume;
    this.#volumeControl.volume = Math.round(volume * 100);
    this.#loadedMusic.settings.volume = volume;
    MusicSettingsStorage.update(this.#loadedMusic);
  }

  downVolume(amount: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const { min, volume } = this.#volumeControl;
    const newVolume = Math.max(min / 100, volume / 100 - amount);
    this.volume = newVolume;
  }

  upVolume(amount: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const { max, volume } = this.#volumeControl;
    const newVolume = Math.min(max / 100, volume / 100 + amount);
    this.volume = newVolume;
  }

  set tempo(tempo: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    this.#audioPlayer.tempo = tempo;
    this.#tempoControl.tempo = tempo;
    this.#loadedMusic.settings.tempo = tempo;
    MusicSettingsStorage.update(this.#loadedMusic);
  }

  downTempo(amount: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const { min, tempo } = this.#tempoControl;
    const newTempo = Math.max(min, tempo - amount);
    this.tempo = newTempo;
  }

  upTempo(amount: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const { max, tempo } = this.#tempoControl;
    const newTempo = Math.min(max, tempo + amount);
    this.tempo = newTempo;
  }

  async play() {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const result = await this.#audioPlayer.play();
    switch (result.type) {
      case "success":
        this.#dispatchEvent("music-player:play", { music: this.#loadedMusic });
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
        this.#dispatchEvent("music-player:pause", { music: this.#loadedMusic });
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
        this.#dispatchEvent(
          `music-player:${result.current === "paused" ? "pause" : "play"}`, //
          { music: this.#loadedMusic },
        );
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
    const result = await this.#audioPlayer.seekTo(sec);
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

  async seekBackward(secs: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const { time, min, max } = this.#playControl;
    const sec = clamp(time - secs, min, max);
    await this.seekTo(sec);
  }

  async seekForward(secs: number) {
    if (this.hasAttribute("inert") || !this.#loadedMusic) return;
    const { time, min, max } = this.#playControl;
    const sec = clamp(time + secs, min, max);
    await this.seekTo(sec);
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

  #loadToUI(music: Music.Music) {
    const { metadata, settings } = music;
    const { format } = metadata;

    this.#playControl.duration = format.duration;
    this.#playControl.time = 0;
    this.#volumeControl.volume = Math.round(settings.volume * 100);
    this.#tempoControl.tempo = settings.tempo;
    this.#controlsFieldset.disabled = false;
  }

  #loadToMediaSession(music: Music.Music) {
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

  #dispatchEvent<Type extends keyof MusicPlayerEventMap>(
    type: Type,
    detail: MusicPlayerEventMap[Type] extends CustomEvent<infer Detail> ? Detail : never,
  ) {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail,
        bubbles: false,
      }),
    );
  }
}
