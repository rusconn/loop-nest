import { clamp } from "./math";

export type AudioPlayerEvents = {
  end: CustomEvent<{}>;
  "entire-loop": CustomEvent<{}>;
};

type State =
  | "unloaded" //
  | "loading"
  | "loaded"
  | "playing"
  | "paused";

export type LoadOptions = {
  tempo?: number;
  volume?: number;
  loop?: boolean | { start: number; end: number };
};

type LoadResult =
  | { type: "success" }
  | { type: "failed"; cause: DOMException }
  | { type: "unsupported" };

type PlayResult =
  | { type: "success" } //
  | { type: "unsupported" };

type PauseResult =
  | { type: "success" } //
  | { type: "unsupported" };

type TogglePlayingResult =
  | { type: "success"; current: "playing" | "paused" }
  | { type: "unsupported" };

type SeekToResult =
  | { type: "success" } //
  | { type: "unsupported" };

type ToggleMuteResult =
  | { type: "success"; current: "muted" | "unmuted" } //
  | { type: "unsupported" };

export class AudioPlayer extends EventTarget {
  #state: State = "unloaded";

  #context: AudioContext | undefined;
  #sourceNode: AudioBufferSourceNode | undefined;
  #gainNode: GainNode | undefined;
  #muteNode: GainNode | undefined;

  #audioDuration = 0;
  #accElapsedTime = 0;
  #intervalStartTime = 0;

  get currentTime() {
    if (!this.#context || !this.#sourceNode) {
      return;
    }

    const currentTime = this.#accElapsedTime + this.#intervalElapsedTime();

    if (this.#sourceNode.loop && this.#sourceNode.loopEnd > 0) {
      if (currentTime >= this.#sourceNode.loopEnd) {
        const introDuration = this.#sourceNode.loopStart;
        const loopDuration = this.#sourceNode.loopEnd - this.#sourceNode.loopStart;
        return ((currentTime - introDuration) % loopDuration) + introDuration;
      }
    } else if (this.#audioDuration > 0 && currentTime >= this.#audioDuration) {
      return currentTime % this.#audioDuration;
    }

    return currentTime;
  }

  set volume(volume: number) {
    if (!this.#context || !this.#gainNode) {
      return;
    }

    switch (this.#state) {
      case "loaded":
      case "playing":
      case "paused":
        this.#gainNode.gain.value = volume;
        break;
      default:
        break;
    }
  }

  set tempo(tempo: number) {
    if (!this.#context || !this.#sourceNode) {
      return;
    }

    switch (this.#state) {
      case "loaded":
      case "playing":
      case "paused":
        this.#accElapsedTime = this.currentTime ?? 0;
        this.#intervalStartTime = this.#context.currentTime;
        this.#sourceNode.playbackRate.value = tempo;
        break;
      default:
        break;
    }
  }

  set muted(muted: boolean) {
    if (!this.#context || !this.#muteNode) {
      return;
    }

    switch (this.#state) {
      case "loaded":
      case "playing":
      case "paused":
        this.#muteNode.gain.value = Number(!muted);
        break;
      default:
        break;
    }
  }

  #intervalElapsedTime() {
    if (!this.#context || !this.#sourceNode) {
      return 0;
    }

    return (
      (this.#context.currentTime - this.#intervalStartTime) * //
      this.#sourceNode.playbackRate.value
    );
  }

  async load(audio: ArrayBuffer, duration: number, options: LoadOptions): Promise<LoadResult> {
    switch (this.#state) {
      case "unloaded":
      case "loaded":
      case "playing":
      case "paused":
        return await this.#load(audio, duration, options);
      default:
        return { type: "unsupported" };
    }
  }

  async #load(audio: ArrayBuffer, duration: number, options: LoadOptions): Promise<LoadResult> {
    if (!this.#context || !this.#gainNode) {
      this.#init();
    }

    this.volume = 0;
    const prevState = this.#state;
    this.#state = "loading";

    const { tempo = 1, volume = 1, loop = false } = options;

    try {
      await this.#recreateSourceNode({ type: "load", audio, tempo, volume, loop });
      this.#state = "loaded";
    } catch (e) {
      this.#state = prevState;
      if (e instanceof DOMException) {
        return { type: "failed", cause: e };
      }
      throw e;
    }
    this.#audioDuration = duration;
    this.#accElapsedTime = 0;
    this.#intervalStartTime = this.#context!.currentTime;

    return { type: "success" };
  }

  #init() {
    this.#context = new AudioContext();
    this.#context.suspend();
    this.#sourceNode = this.#context.createBufferSource();
    this.#gainNode = new GainNode(this.#context, { gain: 1 });
    this.#muteNode = new GainNode(this.#context, { gain: 1 });

    this.#gainNode //
      .connect(this.#muteNode)
      .connect(this.#context.destination);
  }

  async play(): Promise<PlayResult> {
    switch (this.#state) {
      case "loaded":
      case "paused":
        return await this.#play();
      default:
        return { type: "unsupported" };
    }
  }

  async #play(): Promise<PlayResult> {
    if (!this.#context) {
      return { type: "unsupported" };
    }

    await this.#context.resume();
    this.#state = "playing";
    return { type: "success" };
  }

  async pause(): Promise<PauseResult> {
    switch (this.#state) {
      case "playing":
        return await this.#pause();
      default:
        return { type: "unsupported" };
    }
  }

  async #pause(): Promise<PauseResult> {
    if (!this.#context) {
      return { type: "unsupported" };
    }

    await this.#context.suspend();
    this.#state = "paused";
    return { type: "success" };
  }

  async togglePlaying(): Promise<TogglePlayingResult> {
    switch (this.#state) {
      case "loaded":
      case "playing":
      case "paused":
        return await this.#togglePlaying();
      default:
        return { type: "unsupported" };
    }
  }

  async #togglePlaying(): Promise<TogglePlayingResult> {
    if (!this.#context) {
      return { type: "unsupported" };
    }

    switch (this.#context.state) {
      case "running":
        return await this.#pauseForToggle();
      case "suspended":
        return await this.#playForToggle();
      default:
        return { type: "unsupported" };
    }
  }

  async #playForToggle() {
    const result = await this.play();
    switch (result.type) {
      case "success":
        return { ...result, current: "playing" } as const;
      default:
        return result;
    }
  }

  async #pauseForToggle() {
    const result = await this.pause();
    switch (result.type) {
      case "success":
        return { ...result, current: "paused" } as const;
      default:
        return result;
    }
  }

  async seekTo(sec: number): Promise<SeekToResult> {
    switch (this.#state) {
      case "loaded":
      case "playing":
      case "paused":
        return await this.#seekTo(sec);
      default:
        return { type: "unsupported" };
    }
  }

  async #seekTo(sec: number): Promise<SeekToResult> {
    if (!this.#context) {
      return { type: "unsupported" };
    }

    const offset = clamp(sec, 0, this.#audioDuration);
    await this.#recreateSourceNode({ type: "seek", offset });
    this.#accElapsedTime = offset;
    this.#intervalStartTime = this.#context.currentTime;
    return { type: "success" };
  }

  async seekBackward(secs: number): Promise<SeekToResult> {
    return await this.seekTo((this.currentTime ?? 0) - secs);
  }

  async seekForward(secs: number): Promise<SeekToResult> {
    return await this.seekTo((this.currentTime ?? 0) + secs);
  }

  async #recreateSourceNode(args: RecreateSourceNodeArgs) {
    if (!this.#context || !this.#sourceNode || !this.#gainNode) {
      throw new Error("bug");
    }

    const oldSource = this.#sourceNode;
    const newSource = this.#context.createBufferSource();

    let offset;
    switch (args.type) {
      case "load": {
        offset = 0;
        const { audio, tempo, volume, loop } = args;
        // may reject with DOMException
        newSource.buffer = await this.#context.decodeAudioData(
          audio.slice(0), // copy so the caller's buffer stays reusable
        );
        newSource.playbackRate.value = tempo;
        this.#gainNode.gain.value = volume;
        newSource.loop = Boolean(loop);
        if (!loop) {
          newSource.onended = () => {
            this.#dispatchEvent("end", {});
          };
        }
        if (typeof loop === "object") {
          newSource.loopStart = loop.start;
          newSource.loopEnd = loop.end;
          newSource.onended = async () => {
            await this.seekTo(0);
            this.#dispatchEvent("entire-loop", {});
          };
        }
        break;
      }
      case "seek":
        offset = args.offset;
        newSource.buffer = oldSource.buffer;
        newSource.playbackRate.value = oldSource.playbackRate.value;
        newSource.loop =
          oldSource.loopEnd !== 0 //
            ? offset <= oldSource.loopEnd
            : oldSource.loop;
        newSource.loopStart = oldSource.loopStart;
        newSource.loopEnd = oldSource.loopEnd;
        newSource.onended = oldSource.onended;
        break;
      default:
        args satisfies never;
    }

    this.#sourceNode = newSource;
    this.#sourceNode.connect(this.#gainNode);
    this.#sourceNode.start(0, offset);

    oldSource.onended = null;
    oldSource.disconnect();
    oldSource.buffer = null;
  }

  toggleMute(): ToggleMuteResult {
    if (!this.#context || !this.#muteNode) {
      return { type: "unsupported" };
    }

    this.#muteNode.gain.value ^= 1;
    const current = this.#muteNode.gain.value === 0 ? "muted" : "unmuted";
    return { type: "success", current };
  }

  #dispatchEvent<Type extends keyof AudioPlayerEvents>(
    type: Type,
    detail: AudioPlayerEvents[Type] extends CustomEvent<infer Detail> ? Detail : never,
  ) {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail,
        bubbles: false,
      }),
    );
  }
}

type RecreateSourceNodeArgs =
  | RecreateSourceNodeForLoadArgs //
  | RecreateSourceNodeForSeekArgs;

type RecreateSourceNodeForLoadArgs = {
  type: "load";
  audio: ArrayBuffer;
  tempo: number;
  volume: number;
  loop: boolean | { start: number; end: number };
};

type RecreateSourceNodeForSeekArgs = {
  type: "seek";
  offset: number;
};
