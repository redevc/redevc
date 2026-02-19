"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export type AudioWavePlayerProps = {
  src: string;
  title?: string;
};

const SPEED_STEPS = [1, 1.25, 1.5, 2] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const generateFallbackPeaks = (count: number, seedInput: string) => {
  const peaks: number[] = [];
  const seed = hashString(seedInput) || 1;
  let state = seed;

  for (let index = 0; index < count; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const noise = (state / 4294967295 - 0.5) * 0.24;
    const wave = 0.45 + 0.28 * Math.sin(index * 0.23 + seed * 0.0018) + 0.14 * Math.sin(index * 0.07);
    peaks.push(clamp(wave + noise, 0.12, 1));
  }

  return peaks;
};

const computePeaksFromAudioBuffer = (buffer: AudioBuffer, count: number) => {
  const channelData = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const samples = buffer.length;
  const blockSize = Math.max(1, Math.floor(samples / count));
  const peaks = new Array(count).fill(0);

  for (let index = 0; index < count; index += 1) {
    const start = index * blockSize;
    const end = Math.min(start + blockSize, samples);
    let peak = 0;

    for (let offset = start; offset < end; offset += 1) {
      for (let channel = 0; channel < channelData.length; channel += 1) {
        const value = Math.abs(channelData[channel]?.[offset] ?? 0);
        if (value > peak) peak = value;
      }
    }

    peaks[index] = peak;
  }

  const maxPeak = Math.max(...peaks, 0.00001);
  return peaks.map((value) => clamp(Math.pow(value / maxPeak, 0.68), 0.12, 1));
};

const formatPlaybackRate = (value: number) => `${value % 1 === 0 ? value.toFixed(1) : value.toFixed(2)}x`;

export function AudioWavePlayer({ src, title }: AudioWavePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const decodedBufferRef = useRef<AudioBuffer | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pointerActiveRef = useRef(false);
  const barCountRef = useRef(72);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [barCount, setBarCount] = useState(72);
  const [peaks, setPeaks] = useState<number[]>(() => generateFallbackPeaks(72, src));

  const progress = useMemo(() => {
    if (!duration || !Number.isFinite(duration)) return 0;
    return clamp(currentTime / duration, 0, 1);
  }, [currentTime, duration]);

  useEffect(() => {
    barCountRef.current = barCount;
  }, [barCount]);

  useEffect(() => {
    const element = waveformRef.current;
    if (!element) return;

    const updateBarCount = () => {
      const width = element.clientWidth || 0;
      const next = clamp(Math.floor(width / 6), 48, 140);
      setBarCount((prev) => (prev === next ? prev : next));
    };

    updateBarCount();
    const observer = new ResizeObserver(updateBarCount);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncFromAudio = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      syncFromAudio();
    };

    syncFromAudio();
    audio.addEventListener("loadedmetadata", syncFromAudio);
    audio.addEventListener("durationchange", syncFromAudio);
    audio.addEventListener("timeupdate", syncFromAudio);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", syncFromAudio);
      audio.removeEventListener("durationchange", syncFromAudio);
      audio.removeEventListener("timeupdate", syncFromAudio);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    const tick = () => {
      const audio = audioRef.current;
      if (audio) setCurrentTime(audio.currentTime);
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    let context: AudioContext | null = null;

    const decode = async () => {
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();

        const AudioContextCtor =
          window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) throw new Error("AudioContext unavailable");

        context = new AudioContextCtor();
        const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
        if (disposed) return;

        decodedBufferRef.current = buffer;
        setPeaks(computePeaksFromAudioBuffer(buffer, barCountRef.current));
      } catch {
        if (disposed) return;
        decodedBufferRef.current = null;
        setPeaks(generateFallbackPeaks(barCountRef.current, src));
      } finally {
        if (context) {
          void context.close().catch(() => {});
        }
      }
    };

    void decode();

    return () => {
      disposed = true;
      controller.abort();
      if (context) {
        void context.close().catch(() => {});
      }
    };
  }, [src]);

  useEffect(() => {
    if (decodedBufferRef.current) {
      setPeaks(computePeaksFromAudioBuffer(decodedBufferRef.current, barCount));
      return;
    }

    setPeaks(generateFallbackPeaks(barCount, src));
  }, [barCount, src]);

  const seekByRatio = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const nextTime = clamp(ratio, 0, 1) * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const seekFromClientX = (clientX: number) => {
    const waveform = waveformRef.current;
    if (!waveform || !duration) return;

    const rect = waveform.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = (clientX - rect.left) / rect.width;
    seekByRatio(ratio);
  };

  const handlePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
  };

  const handleWaveformPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    pointerActiveRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromClientX(event.clientX);
  };

  const handleWaveformPointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!pointerActiveRef.current) return;
    seekFromClientX(event.clientX);
  };

  const handleWaveformPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    pointerActiveRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWaveformKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!duration) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      audio.currentTime = clamp(audio.currentTime - 5, 0, duration);
      setCurrentTime(audio.currentTime);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      audio.currentTime = clamp(audio.currentTime + 5, 0, duration);
      setCurrentTime(audio.currentTime);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      audio.currentTime = duration;
      setCurrentTime(duration);
    }
  };

  const handleCyclePlaybackRate = () => {
    setPlaybackRate((current) => {
      const currentIndex = SPEED_STEPS.findIndex((speed) => speed === current);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % SPEED_STEPS.length;
      return SPEED_STEPS[nextIndex] ?? 1;
    });
  };

  const sliderLabel = title ? `Audio: ${title}` : "Player de áudio";
  const remainingSeconds = Math.max(0, Math.ceil(duration - currentTime));
  const timeLabel = formatTime(remainingSeconds);
  const sliderTimeLabel = `Tempo restante ${timeLabel}`;

  return (
    <figure className="my-4">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => void handlePlayPause()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-[var(--primary)] transition hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          aria-label={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
          title={title}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>

        <div
          ref={waveformRef}
          role="slider"
          tabIndex={0}
          aria-label={sliderLabel}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={sliderTimeLabel}
          onPointerDown={handleWaveformPointerDown}
          onPointerMove={handleWaveformPointerMove}
          onPointerUp={handleWaveformPointerUp}
          onPointerCancel={handleWaveformPointerUp}
          onKeyDown={handleWaveformKeyDown}
          className="relative h-9 flex-1 cursor-pointer overflow-hidden px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          title={title}
        >
          <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-neutral-300/80" />
          <div
            className="relative z-10 grid h-full items-center gap-[2px]"
            style={{ gridTemplateColumns: `repeat(${peaks.length}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {peaks.map((peak, index) => {
              const threshold = index / Math.max(peaks.length - 1, 1);
              const played = threshold <= progress;

              return (
                <span
                  key={`bar-${index}`}
                  className={played ? "self-center rounded-[2px] bg-[var(--primary)]" : "self-center rounded-[2px] bg-neutral-300"}
                  style={{ height: `${Math.max(14, Math.round(peak * 100))}%` }}
                />
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="w-12 text-right text-xs font-semibold tabular-nums text-neutral-700">{timeLabel}</span>
          <button
            type="button"
            onClick={handleCyclePlaybackRate}
            className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 transition hover:border-[var(--primary)]/40 hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            aria-label={`Velocidade de reprodução: ${formatPlaybackRate(playbackRate)}`}
            title="Alterar velocidade"
          >
            {formatPlaybackRate(playbackRate)}
          </button>
        </div>
      </div>
    </figure>
  );
}
