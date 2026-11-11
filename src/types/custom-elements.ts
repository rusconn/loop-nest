import type { Music } from "../models/music";
import type { TypedEvent } from "../utils/types";
import type { MusicUploaderElement } from "../components/music-uploader";
import type { MusicListElement } from "../components/music-list";
import type { MusicPlayerElement } from "../components/music-player";
import type { PlayControlElement } from "../components/music-player/play-control";
import type { TempoControlElement } from "../components/music-player/tempo-control";
import type { VolumeControlElement } from "../components/music-player/volume-control";

// Uploader
export type UploadFilesDetail = { files: FileList };
export type MusicUploaderEventMap = {
  "music-uploader:upload-files": CustomEvent<UploadFilesDetail>;
};
export type MusicUploaderEvent<Detail = unknown> = TypedEvent<MusicUploaderElement, Detail>;

// List
export type SelectDetail = { music: Music };
export type MusicListEventMap = {
  "music-list:select": CustomEvent<SelectDetail>;
};
export type MusicListEvent<Detail = unknown> = TypedEvent<MusicListElement, Detail>;

// Player
export type PlayDetail = { music: Music };
export type PauseDetail = { music: Music };
export type StartLoadingDetail = { music: Music };
export type CompleteLoadingDetail = { music: Music };
export type FailLoadingDetail = { music: Music };

export type MusicPlayerEventMap = {
  "music-player:play": CustomEvent<PlayDetail>;
  "music-player:pause": CustomEvent<PauseDetail>;
  "music-player:start-loading": CustomEvent<StartLoadingDetail>;
  "music-player:complete-loading": CustomEvent<CompleteLoadingDetail>;
  "music-player:fail-loading": CustomEvent<FailLoadingDetail>;
};
export type MusicPlayerEvent<Detail = unknown> = TypedEvent<MusicPlayerElement, Detail>;

// Play Control
export type PlayControlToggleDetail = {};
export type PlayControlSeekDetail = { second: number };

export type PlayControlEventMap = {
  "play-control:toggle": CustomEvent<PlayControlToggleDetail>;
  "play-control:seek": CustomEvent<PlayControlSeekDetail>;
};
export type PlayControlEvent<Detail = unknown> = TypedEvent<PlayControlElement, Detail>;

// Tempo Control
export type TempoControlResetDetail = {};
export type TempoControlSeekDetail = { tempo: number };

export type TempoControlEventMap = {
  "tempo-control:reset": CustomEvent<TempoControlResetDetail>;
  "tempo-control:seek": CustomEvent<TempoControlSeekDetail>;
};
export type TempoControlEvent<Detail = unknown> = TypedEvent<TempoControlElement, Detail>;

// Volume Control
export type VolumeControlToggleDetail = {};
export type VolumeControlSeekDetail = { volume: number };

export type VolumeControlEventMap = {
  "volume-control:toggle": CustomEvent<VolumeControlToggleDetail>;
  "volume-control:seek": CustomEvent<VolumeControlSeekDetail>;
};
export type VolumeControlEvent<Detail = unknown> = TypedEvent<VolumeControlElement, Detail>;

declare global {
  interface HTMLElementTagNameMap {
    "music-uploader": MusicUploaderElement;
    "music-list": MusicListElement;
    "music-player": MusicPlayerElement;
    "play-control": PlayControlElement;
    "tempo-control": TempoControlElement;
    "volume-control": VolumeControlElement;
  }

  interface GlobalEventHandlersEventMap {
    "music-uploader:upload-files": MusicUploaderEvent<UploadFilesDetail>;
    "music-list:select": MusicListEvent<SelectDetail>;
    "music-player:play": MusicPlayerEvent<PlayDetail>;
    "music-player:pause": MusicPlayerEvent<PauseDetail>;
    "music-player:start-loading": MusicPlayerEvent<StartLoadingDetail>;
    "music-player:complete-loading": MusicPlayerEvent<CompleteLoadingDetail>;
    "music-player:fail-loading": MusicPlayerEvent<FailLoadingDetail>;
    "play-control:toggle": PlayControlEvent<PlayControlToggleDetail>;
    "play-control:seek": PlayControlEvent<PlayControlSeekDetail>;
    "tempo-control:reset": TempoControlEvent<TempoControlResetDetail>;
    "tempo-control:seek": TempoControlEvent<TempoControlSeekDetail>;
    "volume-control:toggle": VolumeControlEvent<VolumeControlToggleDetail>;
    "volume-control:seek": VolumeControlEvent<VolumeControlSeekDetail>;
  }
}

export {};
