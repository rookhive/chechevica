import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import {
  type MouseEvent,
  type PropsWithChildren,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSnapshot } from 'valtio';
import { useSourceSnapshot } from '@/entities/source';
import { usePlayer } from '@/features/media-player';
import { useSegmentsStore } from '@/features/view-segments';
import { useSourceId } from '@/features/view-source';
import { formatSeconds } from '@/shared/lib/time';
import type { Option } from '@/shared/types/common';
import { Icon, type Props as IconProps } from '@/shared/ui/Icon';
import { RippleEffect } from '@/shared/ui/RippleEffect';
import { Select } from '@/shared/ui/Select';
import { Tooltip } from '@/shared/ui/Tooltip';

export const SourceArtifactControls = () => {
  return (
    <div className="flex flex-col gap-2 p-1">
      <Track />
      <ControlsPanel />
    </div>
  );
};

const Track = () => {
  const source = useSourceSnapshot(useSourceId());
  const { scrollTo } = usePlayer();

  const duration = source.duration || 0;

  const [hoverPercent, setHoverPercent] = useState<Option<number>>(null);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const lastSeekAtMsRef = useRef<number>(0);
  const pendingSeekSecondsRef = useRef<Option<number>>(null);
  const seekTimerRef = useRef<Option<ReturnType<typeof setTimeout>>>(null);

  const throttledSeek = useCallback(
    (seconds: number) => {
      const now = Date.now();
      const minIntervalMs = 10;
      const msSinceLast = now - lastSeekAtMsRef.current;

      if (msSinceLast >= minIntervalMs) {
        lastSeekAtMsRef.current = now;
        scrollTo(seconds);
        return;
      }

      pendingSeekSecondsRef.current = seconds;
      if (seekTimerRef.current !== null) return;

      seekTimerRef.current = setTimeout(() => {
        seekTimerRef.current = null;
        const pending = pendingSeekSecondsRef.current;
        if (pending === null) return;
        pendingSeekSecondsRef.current = null;
        lastSeekAtMsRef.current = Date.now();
        scrollTo(pending);
      }, minIntervalMs - msSinceLast);
    },
    [scrollTo]
  );

  const calculatePercentFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    return rect.width === 0 ? 0 : x / rect.width;
  }, []);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    const percent = calculatePercentFromClientX(e.clientX);
    if (percent === undefined) return;
    setHoverPercent(percent);
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    const percent = calculatePercentFromClientX(e.clientX);
    if (percent === undefined) return;
    setHoverPercent(percent);
    throttledSeek(percent * duration);
  };

  const handleMouseLeave = () => {
    if (isDragging) return;
    setHoverPercent(null);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseMove = (e: globalThis.MouseEvent) => {
      const percent = calculatePercentFromClientX(e.clientX);
      if (percent === undefined) return;
      setHoverPercent(percent);
      throttledSeek(percent * duration);
    };

    const stopDragging = (e: globalThis.MouseEvent) => {
      setIsDragging(false);
      // Hide the tooltip only if mouseup happened outside the track
      if (!trackRef.current?.contains(e.target as Node)) {
        setHoverPercent(null);
      }
    };

    document.addEventListener('mousemove', handleWindowMouseMove);
    document.addEventListener('mouseup', stopDragging, { once: true });

    return () => {
      document.removeEventListener('mousemove', handleWindowMouseMove);
      document.removeEventListener('mouseup', stopDragging);
    };
  }, [calculatePercentFromClientX, duration, isDragging, throttledSeek]);

  useEffect(() => {
    return () => {
      if (seekTimerRef.current !== null) {
        clearTimeout(seekTimerRef.current);
        seekTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="relative flex h-6 cursor-pointer items-center rounded-full bg-white/6.5"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <SelectedSegmentRanges />
      <TrackProgressBar ref={trackRef} isDragging={isDragging}>
        <AnimatePresence>
          {hoverPercent !== null && (
            <motion.div
              className="pointer-events-none absolute bottom-full mb-3 -translate-x-1/2 rounded-xl bg-emerald-700/50 px-2 py-1 text-emerald-100 text-xs"
              initial={{ opacity: 0, translateY: -5 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, scale: 0.9, translateY: 5 }}
              transition={{ duration: 0.15 }}
              style={{ left: `${hoverPercent * 100}%` }}
            >
              {formatSeconds(hoverPercent * duration)}
            </motion.div>
          )}
        </AnimatePresence>
      </TrackProgressBar>
    </div>
  );
};

const TrackProgressBar = ({
  ref,
  children,
  isDragging,
}: PropsWithChildren<{
  ref: Ref<HTMLDivElement>;
  isDragging: boolean;
}>) => {
  const source = useSourceSnapshot(useSourceId());
  const player = useSnapshot(usePlayer().state);
  const progress = (player.currentTime / (source.duration || 1)) * 100;

  return (
    <div ref={ref} className="absolute inset-2">
      <div
        className={clsx(
          'absolute top-0 bottom-0 left-0 rounded-full bg-emerald-800',
          !isDragging && 'transition-[width] duration-250 ease-in-out'
        )}
        style={{ width: `${progress}%` }}
      >
        <div className="pointer-events-none absolute top-1/2 right-0 size-4 translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 shadow-lg" />
      </div>
      {children}
    </div>
  );
};

const ControlsPanel = () => {
  const source = useSourceSnapshot(useSourceId());
  const { state, play, pause, scrollTo } = usePlayer();
  const player = useSnapshot(state);
  const duration = source.duration || 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <InterfaceButton
          iconId="replay-10"
          title="Jump back 10 seconds"
          onClick={() => scrollTo(Math.max(0, player.currentTime - 10))}
        />
        <InterfaceButton
          iconId={player.isPlaying ? 'pause' : 'play'}
          title={player.isPlaying ? 'Pause the video' : 'Play the video'}
          onClick={player.isPlaying ? pause : play}
        />
        <InterfaceButton
          iconId="forward-10"
          title="Jump forward 10 seconds"
          onClick={() => scrollTo(Math.min(duration, player.currentTime + 10))}
        />
      </div>
      <div className="flex items-center gap-1">
        <PlaybackTime />
      </div>
      <div className="flex items-center gap-1">
        <VolumeControl />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <PlaybackSpeedMenu />
      </div>
    </div>
  );
};

const InterfaceButton = ({
  children,
  iconId,
  title,
  onClick,
}: PropsWithChildren<{
  iconId: IconProps['id'];
  title?: string;
  onClick: () => void;
}>) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="relative flex cursor-pointer items-center rounded-full bg-white/10 p-1.5 transition-colors duration-200 hover:bg-white/20"
        onClick={onClick}
      >
        <RippleEffect ref={buttonRef} />
        <Icon id={iconId} size={26} className="pointer-events-none shrink-0 text-white" />
        {!!children && <span className={clsx('truncate text-sm')}>{children}</span>}
      </button>
      <Tooltip anchorRef={buttonRef} position="top" status="regular">
        {title}
      </Tooltip>
    </>
  );
};

const VolumeControl = () => {
  const { state, setVolume } = usePlayer();
  const player = useSnapshot(state);
  const [controlsWidth, setControlsWidth] = useState<number>();
  const [currentControlsWidth, setCurrentControlsWidth] = useState(0);
  const muteButtonRef = useRef<HTMLButtonElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const lastVolume = useRef(player.currentVolume);
  const isMuted = player.currentVolume === 0;

  useEffect(() => {
    if (!controlsRef.current) return;
    setControlsWidth(controlsRef.current.scrollWidth);
  }, []);

  const toggleMute = () => {
    if (player.currentVolume > 0) {
      lastVolume.current = player.currentVolume;
      setVolume(0);
    } else {
      setVolume(lastVolume.current);
    }
  };

  const handleMouseEnter = () => {
    setCurrentControlsWidth(controlsWidth ?? 0);
  };

  const handleMouseLeave = () => {
    setCurrentControlsWidth(0);
  };

  return (
    <div
      className="group/volume-control flex items-center rounded-full bg-white/10 text-white transition-colors duration-200 hover:bg-white/20"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={muteButtonRef}
        type="button"
        className={clsx(
          'after:-translate-1/2 relative flex size-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full p-1.5 after:absolute after:top-1/2 after:left-1/2 after:h-0.5 after:w-[75%] after:-rotate-45 after:rounded-xs after:bg-white after:shadow-[0_0_2px_rgb(0_0_0/35%)] after:transition after:duration-350 after:content-[""]',
          isMuted ? 'after:scale-100 after:opacity-100' : 'after:scale-120 after:opacity-0'
        )}
        onClick={toggleMute}
      >
        <RippleEffect ref={muteButtonRef} />
        <Icon id="volume" size={22} className="pointer-events-none shrink-0" />
      </button>
      <Tooltip anchorRef={muteButtonRef} position="top" status="regular">
        {isMuted ? 'Unmute the video' : 'Mute the video'}
      </Tooltip>
      <div
        ref={controlsRef}
        className="flex items-center overflow-hidden opacity-0 transition-all duration-500 group-hover/volume-control:opacity-100"
        style={{ width: `${currentControlsWidth}px` }}
      >
        <input
          className="input-range w-16! cursor-pointer px-1"
          value={player.currentVolume}
          type="range"
          min={0}
          max={1}
          step={0.01}
          onChange={(e) => {
            setVolume(parseFloat(e.currentTarget.value));
          }}
        />
        <div className="w-12 shrink-0 grow pr-2 text-center">
          {Math.round(player.currentVolume * 100)}%
        </div>
      </div>
    </div>
  );
};

const PlaybackTime = () => {
  const source = useSourceSnapshot(useSourceId());
  const player = useSnapshot(usePlayer().state);

  const duration = source.duration || 0;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isRemainingMode, setIsRemainingMode] = useState(false);
  const displaySeconds = isRemainingMode
    ? Math.max(0, duration - player.currentTime)
    : player.currentTime;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="relative flex h-9.5 cursor-pointer items-center rounded-full bg-white/10 px-3 transition-colors duration-200 hover:bg-white/20"
        onClick={() => setIsRemainingMode((isRemainingMode) => !isRemainingMode)}
      >
        <RippleEffect ref={buttonRef} />
        <span className="text-white text-xs">
          {isRemainingMode ? '-' : ''}
          {formatSeconds(displaySeconds)} / {formatSeconds(duration)}
        </span>
      </button>
      <Tooltip anchorRef={buttonRef} position="top" status="regular">
        {isRemainingMode ? 'Show elapsed time' : 'Show remaining time'}
      </Tooltip>
    </>
  );
};

const PlaybackSpeedMenu = () => {
  const { state, setPlaybackRate } = usePlayer();
  const player = useSnapshot(state);

  const items = useMemo(
    () => [
      { id: 0.25, label: '0.25', onClick: () => setPlaybackRate(0.25) },
      { id: 0.5, label: '0.5', onClick: () => setPlaybackRate(0.5) },
      { id: 0.75, label: '0.75', onClick: () => setPlaybackRate(0.75) },
      { id: 1, label: 'Normal', onClick: () => setPlaybackRate(1) },
      { id: 1.25, label: '1.25', onClick: () => setPlaybackRate(1.25) },
      { id: 1.5, label: '1.5', onClick: () => setPlaybackRate(1.5) },
      { id: 1.75, label: '1.75', onClick: () => setPlaybackRate(1.75) },
      { id: 2, label: '2', onClick: () => setPlaybackRate(2) },
      { id: 2.5, label: '2.5', onClick: () => setPlaybackRate(2.5) },
      { id: 3, label: '3', onClick: () => setPlaybackRate(3) },
    ],
    [setPlaybackRate]
  );

  return (
    <Select
      items={items}
      selectedId={player.currentPlaybackRate}
      position="top"
      align="end"
      menuClassName="min-w-[105px]"
      renderSelectedItem={(item) => (
        <span>
          <span className="text-neutral-400">Playback speed:</span> {item?.label}
        </span>
      )}
    />
  );
};

const SelectedSegmentRanges = () => {
  const source = useSourceSnapshot(useSourceId());
  const segmentsStore = useSegmentsStore();
  const { selectedSegments } = useSnapshot(segmentsStore.state);
  const duration = source.duration || 0;
  const isAdjacent = (left: number, right: number) => Math.abs(left - right) < 0.001;

  return (
    <AnimatePresence>
      {selectedSegments.map((segment, index, segments) => {
        const prev = segments[index - 1];
        const next = segments[index + 1];
        const isAdjacentLeft = prev ? isAdjacent(prev.end, segment.start) : false;
        const isAdjacentRight = next ? isAdjacent(segment.end, next.start) : false;
        const startPercent = (segment.start / duration) * 100;
        const endPercent = (segment.end / duration) * 100;
        const widthPercent = endPercent - startPercent;
        return (
          <motion.div
            key={segment.id}
            initial={{ opacity: 0, scaleY: 0.5 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.5 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={clsx(
              'pointer-events-none absolute top-0 bottom-0 rounded-md bg-sky-600/70',
              isAdjacentLeft && 'rounded-l-none',
              isAdjacentRight && 'rounded-r-none'
            )}
            style={{
              left: `${startPercent}%`,
              width: `${widthPercent}%`,
            }}
          />
        );
      })}
    </AnimatePresence>
  );
};
