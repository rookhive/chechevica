import { proxy } from 'valtio';
import type { Option } from '@/shared/types/common';

export type State = {
  isPlaying: boolean;
  currentTime: number;
  currentVolume: number;
  currentPlaybackRate: number;
};

export const getDefaultState = (): State => ({
  isPlaying: false,
  currentTime: 0,
  currentVolume: 1,
  currentPlaybackRate: 1,
});

export type PlayerStore = ReturnType<typeof createPlayerStore>;

export const createPlayerStore = () => {
  const state = proxy<State>(getDefaultState());
  const noop = () => {};
  const timeEqualityThreshold = 0.00001;

  let mediaElement: Option<HTMLMediaElement> = null;
  let cleanupMediaListeners = noop;
  let cleanupPendingSeek = noop;
  let pendingPlayRequest: Option<Promise<void>> = null;

  const getValidTime = (time: number) => {
    if (!Number.isFinite(time) || time < 0) return null;
    return time;
  };

  const areTimesEqual = (left: number, right: number) => {
    return Math.abs(left - right) <= timeEqualityThreshold;
  };

  const setCurrentTimeState = (time: number) => {
    const validTime = getValidTime(time);
    if (validTime == null || areTimesEqual(state.currentTime, validTime)) return;
    state.currentTime = validTime;
  };

  const isAbortError = (error: unknown) => {
    return error instanceof DOMException && error.name === 'AbortError';
  };

  const clearPendingPlayRequest = () => {
    pendingPlayRequest = null;
  };

  const requestPlay = (element: HTMLMediaElement) => {
    if (pendingPlayRequest) return pendingPlayRequest;

    const playResult = element.play();
    if (playResult === undefined) {
      clearPendingPlayRequest();
      return Promise.resolve();
    }

    const trackedPlayRequest = playResult
      .catch((error) => {
        if (isAbortError(error)) return;
        throw error;
      })
      .finally(() => {
        if (pendingPlayRequest === trackedPlayRequest) {
          clearPendingPlayRequest();
        }
      });

    pendingPlayRequest = trackedPlayRequest;

    return pendingPlayRequest;
  };

  const requestPause = (element: HTMLMediaElement) => {
    clearPendingPlayRequest();
    element.pause();
  };

  const releaseMediaElement = (element: Option<HTMLMediaElement>) => {
    if (!element) return;
    requestPause(element);
    (element as HTMLMediaElement & { srcObject?: Option<MediaStream> }).srcObject = null;
  };

  const setCurrentTimeSafely = (element: HTMLMediaElement, time: number) => {
    const validTime = getValidTime(time);
    if (validTime == null) return;

    if (element.readyState >= 1) {
      cleanupPendingSeek();
      element.currentTime = validTime;
      return;
    }

    cleanupPendingSeek();
    const onLoadedMetadata = () => {
      cleanupPendingSeek = noop;
      element.currentTime = validTime;
    };
    element.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    cleanupPendingSeek = () => {
      element.removeEventListener('loadedmetadata', onLoadedMetadata);
      cleanupPendingSeek = noop;
    };
  };

  return {
    state,

    resetState() {
      const previousElement = mediaElement;
      cleanupMediaListeners();
      cleanupMediaListeners = noop;
      cleanupPendingSeek();
      mediaElement = null;
      releaseMediaElement(previousElement);
      state.isPlaying = false;
      state.currentTime = 0;
      state.currentVolume = 1;
      state.currentPlaybackRate = 1;
    },

    play() {
      if (!mediaElement) return;
      requestPlay(mediaElement);
    },

    pause() {
      if (!mediaElement) return;
      requestPause(mediaElement);
    },

    setVolume(volume: number) {
      if (!Number.isFinite(volume)) return;
      const clamped = Math.max(0, Math.min(1, volume));
      state.currentVolume = clamped;
      if (mediaElement) {
        mediaElement.volume = clamped;
      }
    },

    setPlaybackRate(rate: number) {
      if (!Number.isFinite(rate) || rate <= 0) return;
      state.currentPlaybackRate = rate;
      if (mediaElement) {
        mediaElement.playbackRate = rate;
      }
    },

    setMediaElement(media: HTMLMediaElement) {
      if (mediaElement === media) return;

      const previousElement = mediaElement;
      cleanupMediaListeners();
      cleanupMediaListeners = noop;
      cleanupPendingSeek();
      releaseMediaElement(previousElement);
      mediaElement = media;

      const onTimeUpdate = () => setCurrentTimeState(media.currentTime);
      const onSeeked = () => setCurrentTimeState(media.currentTime);
      const onPlay = () => (state.isPlaying = true);
      const onPause = () => (state.isPlaying = false);
      const onVolumeChange = () => (state.currentVolume = media.volume);
      const onRateChange = () => (state.currentPlaybackRate = media.playbackRate);

      media.addEventListener('timeupdate', onTimeUpdate);
      media.addEventListener('seeked', onSeeked);
      media.addEventListener('play', onPlay);
      media.addEventListener('pause', onPause);
      media.addEventListener('volumechange', onVolumeChange);
      media.addEventListener('ratechange', onRateChange);

      cleanupMediaListeners = () => {
        media.removeEventListener('timeupdate', onTimeUpdate);
        media.removeEventListener('seeked', onSeeked);
        media.removeEventListener('play', onPlay);
        media.removeEventListener('pause', onPause);
        media.removeEventListener('volumechange', onVolumeChange);
        media.removeEventListener('ratechange', onRateChange);
        cleanupMediaListeners = noop;
      };

      setCurrentTimeSafely(media, state.currentTime);

      if (Number.isFinite(state.currentPlaybackRate) && state.currentPlaybackRate > 0) {
        media.playbackRate = state.currentPlaybackRate;
      }
      state.currentPlaybackRate = media.playbackRate;

      const clampedVolume = Math.max(0, Math.min(1, state.currentVolume));
      media.volume = clampedVolume;
      state.currentVolume = clampedVolume;
      state.isPlaying ? requestPlay(media) : requestPause(media);
    },

    scrollTo(time: number) {
      const validTime = getValidTime(time);
      if (validTime == null) return;
      setCurrentTimeState(validTime);
      if (!mediaElement) {
        return;
      }
      setCurrentTimeSafely(mediaElement, validTime);
    },
  };
};
