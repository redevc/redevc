import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { Tabs, Tab } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";

const CHANNEL_ID = "UCqYhmiUr56OrPc89yy5RcmA";
const CHANNEL_URL = `https://www.youtube.com/channel/${CHANNEL_ID}`;

type Video = {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  thumbnail: string;
  isLive: boolean;
};

type VideosResponse = {
  items: Video[];
  nextPageToken?: string | null;
};

type Short = {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  thumbnail: string;
  viewCount: number;
  durationSec: number;
  score: number;
};

type ShortsResponse = {
  items: Short[];
  nextPageToken?: string | null;
};

const timeAgo = (iso: string) => {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
};

export function Youtube() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"videos" | "shorts">("videos");
  const [shorts, setShorts] = useState<Short[]>([]);
  const [loadingShorts, setLoadingShorts] = useState(false);
  const [errorShorts, setErrorShorts] = useState<string | null>(null);
  const [shortsSort, setShortsSort] = useState<"recent" | "oldest" | "popular">("recent");
  const [shortsOverlayIndex, setShortsOverlayIndex] = useState<number | null>(null);
  const [animDirection, setAnimDirection] = useState<1 | -1>(1);
  const touchStartYRef = useRef(0);
  const touchFromInteractiveRef = useRef(false);
  const shortPlayerRef = useRef<HTMLIFrameElement | null>(null);
  const [isShortPlaying, setIsShortPlaying] = useState(true);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const fetchVideos = useCallback(
    async (pageToken?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/videos${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ""}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Falha ao carregar vídeos (${res.status})`);
        const data = (await res.json()) as VideosResponse;
        setNextPageToken(data.nextPageToken ?? null);
        setVideos((prev) => {
          const combined = [...prev, ...(data.items ?? [])];
          const seen = new Set<string>();
          return combined.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
        });
      } catch (err) {
        console.error("Erro ao carregar vídeos", err);
        setError("Não foi possível carregar os vídeos agora.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchVideos().catch(() => {});
  }, [fetchVideos]);

  const fetchShorts = useCallback(async () => {
    if (shorts.length > 0 || loadingShorts) return;
    setLoadingShorts(true);
    setErrorShorts(null);
    try {
      const res = await fetch("/api/shorts");
      if (!res.ok) throw new Error(`Falha ao carregar shorts (${res.status})`);
      const data = (await res.json()) as ShortsResponse;
      setShorts(data.items ?? []);
    } catch (err) {
      console.error("Erro ao carregar shorts", err);
      setErrorShorts("Não foi possível carregar os shorts agora.");
    } finally {
      setLoadingShorts(false);
    }
  }, [loadingShorts, shorts.length]);

  useEffect(() => {
    if (!selectedId && videos.length > 0) {
      setSelectedId(videos[0].id);
    }
  }, [videos, selectedId]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    update(mq);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const hero = selectedId ? videos.find((v) => v.id === selectedId) ?? videos[0] : videos[0];
  const rest = videos.filter((v) => v.id !== hero?.id);
  const visibleRest = isMobile ? rest.slice(0, 3) : rest;
  const hasLive = videos.some((v) => v.isLive);
  const shortsList = shorts;

  const heroHeight = "max-h-[360px] sm:max-h-[460px] lg:max-h-[540px]";

  const sortedShorts = (() => {
    const list = [...shortsList];
    if (shortsSort === "popular") {
      return list.sort((a, b) => b.viewCount - a.viewCount || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    }
    if (shortsSort === "oldest") {
      return list.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    }
    // recent
    return list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  })();

  useEffect(() => {
    // se a lista ou ordenação mudar, resetar overlay para evitar inconsistência de índice
    setShortsOverlayIndex(null);
  }, [shortsSort, sortedShorts.length]);

  useEffect(() => {
    if (shortsOverlayIndex == null) return;
    const current = sortedShorts[shortsOverlayIndex];
    if (!current) setShortsOverlayIndex(null);
    setIsShortPlaying(true);
  }, [shortsOverlayIndex, sortedShorts]);

  const goToShort = (dir: 1 | -1) => {
    setShortsOverlayIndex((prev) => {
      if (prev == null) return null;
      setAnimDirection(dir);
      const next = prev + dir;
      if (next < 0 || next >= sortedShorts.length) return prev;
      return next;
    });
  };

  const renderShortsOverlay = () => {
    if (shortsOverlayIndex == null) return null;
    const current = sortedShorts[shortsOverlayIndex];
    if (!current) return null;
    const playerRef = shortPlayerRef;

    const toggleShortPlayback = () => {
      const win = playerRef.current?.contentWindow;
      if (!win) return;
      if (isShortPlaying) {
        win.postMessage('{"event":"command","func":"pauseVideo","args":[]}', "*");
      } else {
        win.postMessage('{"event":"command","func":"playVideo","args":[]}', "*");
      }
      setIsShortPlaying((prev) => !prev);
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      touchStartYRef.current = e.touches?.[0]?.clientY ?? 0;
      touchFromInteractiveRef.current = !!(e.target as HTMLElement | null)?.closest("[data-short-interactive]");
    };
    const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
      const endY = e.changedTouches?.[0]?.clientY ?? 0;
      const delta = endY - touchStartYRef.current;
      const tapThreshold = 12;
      const swipeThreshold = 40;
      if (Math.abs(delta) <= tapThreshold) {
        toggleShortPlayback();
      } else if (delta < -swipeThreshold) {
        goToShort(1);
      } else if (delta > swipeThreshold) {
        goToShort(-1);
      }
      touchFromInteractiveRef.current = false;
    };
    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
      const threshold = 20;
      if (Math.abs(e.deltaY) < threshold) return;
      if (e.deltaY > 0) goToShort(1);
      else goToShort(-1);
    };

    return (
      <div
        className="fixed inset-0 z-[120] bg-black flex flex-col items-center justify-center touch-pan-y"
        onTouchStartCapture={handleTouchStart}
        onTouchEndCapture={handleTouchEnd}
        onWheelCapture={handleWheel}
        onClickCapture={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest("[data-short-control]")) return;
          toggleShortPlayback();
        }}
      >
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button
            type="button"
            onClick={() => setShortsOverlayIndex(null)}
            data-short-control
            className="h-10 w-10 rounded-full bg-black/70 border border-white/20 text-white text-lg font-semibold flex items-center justify-center hover:bg-black/85"
            aria-label="Fechar shorts"
          >
            ×
          </button>
        </div>
        <div className="w-full h-full relative overflow-hidden bg-black">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={current.id}
              initial={{ y: animDirection * 140, opacity: 0.45 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -animDirection * 140, opacity: 0.35 }}
              transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
              className="absolute inset-0 w-full h-full"
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.12}
              onDragEnd={(_, info) => {
                const threshold = 80;
                const velocityThreshold = 500;
                if (info.offset.y < -threshold || info.velocity.y < -velocityThreshold) {
                  goToShort(1);
                } else if (info.offset.y > threshold || info.velocity.y > velocityThreshold) {
                  goToShort(-1);
                }
              }}
              onPanEnd={(_, info) => {
                const threshold = 80;
                if (info.offset.y < -threshold) goToShort(1);
                else if (info.offset.y > threshold) goToShort(-1);
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-full max-w-[520px] h-full">
                  <iframe
                    title={current.title}
                    ref={(el) => {
                      playerRef.current = el;
                      if (el) {
                        const win = el.contentWindow;
                        setTimeout(() => {
                          win?.postMessage('{"event":"command","func":"playVideo","args":[]}', "*");
                          win?.postMessage('{"event":"command","func":"unMute","args":[]}', "*");
                        }, 50);
                      }
                    }}
                    onLoad={() => {
                      const win = playerRef.current?.contentWindow;
                      win?.postMessage('{"event":"command","func":"playVideo","args":[]}', "*");
                      win?.postMessage('{"event":"command","func":"unMute","args":[]}', "*");
                      setIsShortPlaying(true);
                    }}
                    src={`https://www.youtube.com/embed/${current.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&controls=1&fs=0&loop=1&playlist=${current.id}&disablekb=1&enablejsapi=1&iv_load_policy=3&origin=${encodeURIComponent(origin)}`}
                    className="absolute inset-0 h-full w-full pointer-events-none"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    data-short-interactive
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-transparent" />
                </div>
              </div>
              <div className="absolute bottom-6 left-0 right-0 px-4 text-white space-y-2 pointer-events-none">
                <div className="space-y-2">
                  <p className="text-lg font-semibold leading-snug max-w-xl line-clamp-3">
                    {current.title}
                  </p>
                  <p className="text-sm text-white/70 max-w-xl">
                    Deslize para cima ou para baixo para trocar de short.
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          {sortedShorts[shortsOverlayIndex + 1] ? (
            <iframe
              title="preload-next"
              src={`https://www.youtube.com/embed/${sortedShorts[shortsOverlayIndex + 1].id}?autoplay=0&mute=1&rel=0&modestbranding=1&playsinline=1&controls=0&fs=0&loop=1&playlist=${sortedShorts[shortsOverlayIndex + 1].id}&disablekb=1&enablejsapi=1&iv_load_policy=3&origin=${encodeURIComponent(origin)}`}
              className="invisible h-0 w-0"
              tabIndex={-1}
            />
          ) : null}
          {sortedShorts[shortsOverlayIndex - 1] ? (
            <iframe
              title="preload-prev"
              src={`https://www.youtube.com/embed/${sortedShorts[shortsOverlayIndex - 1].id}?autoplay=0&mute=1&rel=0&modestbranding=1&playsinline=1&controls=0&fs=0&loop=1&playlist=${sortedShorts[shortsOverlayIndex - 1].id}&disablekb=1&enablejsapi=1&iv_load_policy=3&origin=${encodeURIComponent(origin)}`}
              className="invisible h-0 w-0"
              tabIndex={-1}
            />
          ) : null}
        </div>
      </div>
    );
  };

  const renderShortsFeed = () => {
    const items = sortedShorts;
    return (
      <div className="w-full flex justify-center">
        <div className="w-full max-w-7xl relative">
          <div className="hidden md:flex absolute inset-y-0 left-0 items-center z-10">
            <button
              type="button"
              onClick={() => {
                const scroller = document.getElementById("shorts-row");
                if (scroller) scroller.scrollBy({ left: -320, behavior: "smooth" });
              }}
              className="h-12 w-12 rounded-full bg-black/70 border border-white/15 text-white text-lg font-semibold shadow-lg hover:bg-black/85"
              aria-label="Anterior"
            >
              ‹
            </button>
          </div>
          <div className="hidden md:flex absolute inset-y-0 right-0 items-center justify-end z-10">
            <button
              type="button"
              onClick={() => {
                const scroller = document.getElementById("shorts-row");
                if (scroller) scroller.scrollBy({ left: 320, behavior: "smooth" });
              }}
              className="h-12 w-12 rounded-full bg-black/70 border border-white/15 text-white text-lg font-semibold shadow-lg hover:bg-black/85"
              aria-label="Próximo"
            >
              ›
            </button>
          </div>
          <div
            id="shorts-row"
            className="w-full max-w-7xl overflow-x-auto snap-x snap-mandatory flex gap-4 pb-4 px-1 sm:px-2 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent"
          >
          {loadingShorts
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="snap-start aspect-[9/16] min-w-[160px] sm:min-w-[190px] rounded-2xl bg-gradient-to-br from-[#1f1f1f] to-[#0f0f0f] animate-pulse"
                />
              ))
            : items.map((short, idx) => (
                <motion.button
                  key={short.id}
                  type="button"
                  onClick={() => {
                    setShortsOverlayIndex(idx);
                  }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.03, ease: "easeOut" }}
                  whileTap={{ scale: 0.98, opacity: 0.9 }}
                  className="relative snap-start aspect-[9/16] min-w-[160px] sm:min-w-[190px] overflow-hidden rounded-2xl bg-neutral-900 shadow-[0_18px_48px_rgba(0,0,0,0.45)] border border-white/10 text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={short.thumbnail}
                    alt={short.title}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2 text-white">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/80">
                      <span className="rounded-full bg-white/15 px-2 py-[2px]">
                        {short.durationSec}s
                      </span>
                      <span className="rounded-full bg-white/15 px-2 py-[2px]">
                        {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(short.viewCount)} views
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-snug line-clamp-2">
                      {short.title}
                    </p>
                  </div>
                </motion.button>
              ))}
          {!loadingShorts && !items.length ? (
            <div className="text-center text-sm text-neutral-300 py-6">Nenhum short encontrado.</div>
          ) : null}
          {errorShorts ? <div className="text-center text-sm text-orange-300 py-6">{errorShorts}</div> : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="mt-10 w-full bg-neutral-900 text-white flex justify-center">
      <div className="w-full max-w-7xl px-3 sm:px-4 py-5">
        <div className="flex flex-col gap-3 px-1 sm:px-0 pb-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 rounded-full bg-gradient-to-b from-orange-400 via-red-500 to-pink-500" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-400">Rede Você</p>
              <h3 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
                Conteúdos
                {activeTab === "videos" && hasLive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600/80 px-2 py-[2px] text-[11px] font-semibold uppercase tracking-[0.12em]">
                    ● Live agora
                  </span>
                ) : null}
              </h3>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Tabs
              aria-label="Escolher conteúdo"
              selectedKey={activeTab}
              onSelectionChange={(key) => {
                const val = key === "shorts" ? "shorts" : "videos";
                setActiveTab(val as "videos" | "shorts");
                if (val === "shorts") fetchShorts().catch(() => {});
              }}
              color="warning"
              variant="underlined"
              classNames={{
                tab: "px-0 data-[selected=true]:text-orange-400",
              }}
            >
              <Tab key="videos" title="Vídeos" />
              <Tab key="shorts" title="Para você" />
            </Tabs>
            {activeTab === "videos" ? (
              <Link
                href={CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-red-500/80 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-600/20 transition whitespace-nowrap"
              >
                Ver canal
              </Link>
            ) : null}
          </div>
        </div>

        {activeTab === "videos" ? (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4 lg:gap-5">
          {/* Player */}
          <div className={`relative w-full aspect-video ${heroHeight} rounded-2xl overflow-hidden bg-[#0a0a0a] shadow-[0_18px_48px_rgba(0,0,0,0.45)]`}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,78,69,0.12),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.06),transparent_30%),linear-gradient(135deg,rgba(255,78,69,0.06),rgba(17,17,17,0.0))]" />
            {hero ? (
              <>
                <iframe
                  title={hero.title}
                  src={`https://www.youtube.com/embed/${hero.id}?rel=0&modestbranding=1&playsinline=1${hero.isLive ? "&autoplay=1" : ""}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full"
                />
                {hero.isLive ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#ff4e45] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] shadow-lg">
                    ● Ao vivo
                  </span>
                ) : null}
                <Link
                  href={hero.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-3 bottom-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[12px] font-semibold text-white border border-white/10 hover:bg-black/80 transition"
                >
                  Assistir no YouTube
                </Link>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-full w-full animate-pulse bg-gradient-to-br from-[#1f1f1f] to-[#0f0f0f]" />
              </div>
            )}
          </div>

          {/* Queue */}
          <div className="w-full bg-[#161616] p-3 sm:p-4 flex flex-col gap-3 rounded-xl border border-[#303030] lg:max-h-[540px] shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
            {visibleRest.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-col lg:overflow-y-auto gap-3 lg:gap-2 lg:pr-1 lg:max-h-[460px] scrollbar-thin scrollbar-thumb-[#555] scrollbar-track-transparent">
                {visibleRest.map((video) => (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => setSelectedId(video.id)}
                    className={`group flex w-full gap-3 rounded-lg border p-2 text-left transition ${
                      selectedId === video.id
                        ? "border-[#ff4e45] bg-[#222222] shadow-[0_6px_18px_rgba(255,78,69,0.2)]"
                        : "border-transparent bg-[#1a1a1a] hover:bg-[#222222] hover:border-[#303030]"
                    }`}
                  >
                    <div className="h-16 w-28 overflow-hidden rounded-md bg-neutral-800 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="min-w-0 flex flex-col gap-1">
                      <p className="text-sm font-semibold text-[#f1f1f1] line-clamp-2 group-hover:text-white transition-colors">
                        {video.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-[#aaaaaa]">
                        <span>{timeAgo(video.publishedAt)}</span>
                        {video.isLive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#ff4e45] px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                            ● Live
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-col gap-3 lg:gap-2">
                {Array.from({ length: isMobile ? 3 : 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex w-full gap-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-2 animate-pulse"
                  >
                    <div className="h-16 w-28 rounded-md bg-[#2a2a2a]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 bg-[#2a2a2a] rounded" />
                      <div className="h-3 w-32 bg-[#2a2a2a] rounded" />
                      <div className="h-3 w-20 bg-[#2a2a2a] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>

          <div className="px-2 sm:px-3 pb-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
            {error ? <p className="text-sm text-orange-300">{error}</p> : <span />}
            <button
              type="button"
              onClick={() => fetchVideos(nextPageToken ?? undefined)}
              disabled={loading || !nextPageToken}
              className="inline-flex items-center gap-2 rounded-full border border-[#303030] px-4 py-2 text-sm font-semibold text-[#f1f1f1] hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#1a1a1a] transition-colors cursor-progress"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-[#f1f1f1]/60 border-t-transparent animate-spin" />
                  Carregando...
                </>
              ) : nextPageToken ? (
                <>
                  Carregar mais
                </>
              ) : (
                "Fim da lista"
              )}
            </button>
          </div>
          </>
        ) : (
          <div className="mt-2 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1 sm:px-0">
              <p className="text-sm text-white/70">Para você <span className="font-extrabold">·</span> <span className="text-red-500 font-bold">Shorts</span></p>
              <div className="inline-flex items-center gap-2 sm:gap-1 rounded-md bg-primary/90 border border-primary/30 p-1 text-xs">
                <span className="px-1 text-white/90">Ordenar por:</span>
                {[
                  { key: "recent", label: "Recentes" },
                  { key: "oldest", label: "Antigas" },
                  { key: "popular", label: "Populares" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setShortsSort(opt.key as typeof shortsSort)}
                    className={`px-3 py-1 rounded-full transition ${
                      shortsSort === opt.key ? "bg-white text-neutral-900 font-semibold" : "text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {renderShortsFeed()}
          </div>
        )}
      </div>
      {renderShortsOverlay()}
    </section>
  );
}
