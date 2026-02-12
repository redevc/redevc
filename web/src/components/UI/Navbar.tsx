"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Kbd, Progress } from "@heroui/react";
import {
  Search,
  X,
  Clock,
  TrendingUp,
  ChevronRight,
  Bell,
} from "lucide-react";

import { useNewsSearch } from "@/lib/use-search";
import { fetchTopNews } from "@/lib/api/news";
import type { News } from "@/types/news";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserStatus } from "@/components/UI/user/UserStatus";

const ROTATION_INTERVAL = 6000;

const formatDate = (date: Date) =>
  date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function SearchOverlay({
  isOpen,
  onClose,
  locationLabel,
}: {
  isOpen: boolean;
  onClose: () => void;
  locationLabel: string;
}) {
  const { query, setQuery, results, loading, error } = useNewsSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-100 flex items-start justify-center pt-[10vh] px-4 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -20 }}
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center border-b border-neutral-100 p-4">
              <Search className="mr-3 h-5 w-5 text-neutral-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder={`Pesquisar em ${locationLabel}...`}
                className="w-full bg-transparent text-lg outline-none placeholder:text-neutral-400"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                onClick={onClose}
                className="ml-2 rounded-full p-1 hover:bg-neutral-100 transition-colors"
                aria-label="Fechar busca"
              >
                <X className="h-5 w-5 text-neutral-500" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {query.length === 0 ? (
                <div className="space-y-6 py-4">
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
                      <TrendingUp className="h-3 w-3" /> Tendências em {locationLabel}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {["Economia", "Política", "Clima", "Educação", "Saúde"].map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setQuery(tag)}
                          className="rounded-full border border-neutral-200 px-3 py-1 text-sm hover:bg-neutral-50 transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-neutral-50 p-4">
                    <p className="text-sm text-neutral-500">
                      Digite algo para buscar notícias, artigos e reportagens exclusivas.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="px-2 py-2 text-xs font-medium text-neutral-400">
                    {loading
                      ? "Buscando..."
                      : error
                        ? error
                        : results.length > 0
                          ? `Resultados para "${query}"`
                          : `Nenhum resultado encontrado para "${query}"`}
                  </p>
                  {loading ? (
                    <div className="space-y-2 px-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-12 rounded-lg bg-neutral-100 animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    results.map((result) => (
                      <Link
                        key={result.id}
                        href={`/news/${result.slug}`}
                        onClick={onClose}
                        className="group flex cursor-pointer items-center justify-between rounded-lg p-3 hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-neutral-100 text-neutral-400 group-hover:bg-white group-hover:text-red-600 transition-colors">
                            <Search className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-neutral-900 line-clamp-1">{result.title}</p>
                            <p className="text-xs text-neutral-500 line-clamp-1">
                              {result.description || "Visualizar notícia"}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-neutral-600" />
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50 px-4 py-3 text-[10px] text-neutral-400">
              <div className="flex gap-4">
                <span className="flex items-center gap-1"><Kbd className="py-0 px-1">ESC</Kbd> para fechar</span>
                <span className="flex items-center gap-1"><Kbd className="py-0 px-1">ENTER</Kbd> para buscar</span>
              </div>
              <span className="font-medium">Rede Você Editorial</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function NewsNavbar() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [tickerNews, setTickerNews] = useState<News[]>([]);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollContainerRef = useRef<HTMLElement | Window | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const activeTicker = tickerNews.length
    ? tickerNews[Math.min(tickerIndex, Math.max(0, tickerNews.length - 1))]
    : undefined;

  const currentLocation = "Rede Você";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag") ?? "";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let cancel = false;

    const loadTicker = async () => {
      try {
        const news = await fetchTopNews(8);
        const featured = news.filter((p) => {
          if (!p.isFeatured) return false;
          if (!p.featuredUntil) return true;
          return new Date(p.featuredUntil) > new Date();
        });
        if (!cancel) setTickerNews(featured);
      } catch (err) {
        console.error("Erro ao carregar manchetes", err);
      }
    };

    loadTicker();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (tickerNews.length <= 1) return;

    const id = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerNews.length);
    }, ROTATION_INTERVAL);

    return () => clearInterval(id);
  }, [tickerNews.length]);

  useEffect(() => {
    const container = document.querySelector<HTMLElement>("[data-scroll-container]");
    scrollContainerRef.current = container ?? window;

    const measure = () => {
      const target = scrollContainerRef.current;
      const total =
        target && target !== window
          ? (target as HTMLElement).scrollHeight - (target as HTMLElement).clientHeight
          : document.documentElement.scrollHeight - window.innerHeight;
      const current =
        target && target !== window ? (target as HTMLElement).scrollTop : window.scrollY;
      const value = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
      setScrollProgress(value);
    };

    const scheduleMeasure = () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(measure);
    };

    measure();
    const target = scrollContainerRef.current;
    target?.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure);

    const resizeObserver =
      target && target !== window ? new ResizeObserver(scheduleMeasure) : null;
    if (resizeObserver && target && target !== window) resizeObserver.observe(target as HTMLElement);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      target?.removeEventListener("scroll", scheduleMeasure as EventListener);
      window.removeEventListener("resize", scheduleMeasure);
      resizeObserver?.disconnect();
    };
  }, [pathname]);

  return (
    <header className="relative left-0 z-50 w-full shadow-sm">
      {/* TOP STATUS BAR */}
      <div className="bg-neutral-950 text-white text-[11px] font-medium tracking-tight">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-2 sm:py-1.5">
          <div className="flex w-full sm:w-auto items-center gap-3 sm:gap-4 overflow-hidden">
            <div className="flex items-center gap-1.5 border-r border-neutral-800 pr-3 sm:pr-4">
              <Clock className="h-3 w-3 text-neutral-500" />
              <time className="text-neutral-400 uppercase">{formatDate(new Date())}</time>
            </div>

            <div className="relative h-5 overflow-hidden flex-1 min-w-0">
              <AnimatePresence mode="wait">
                  {activeTicker ? (
                    <motion.div
                      key={activeTicker.slug}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="flex items-center gap-3 whitespace-nowrap min-w-0"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      <Link
                        href={`/news/${activeTicker.slug}`}
                        className="text-neutral-200 hover:text-white cursor-pointer transition-colors truncate"
                        title={activeTicker.title}
                      >
                        {activeTicker.title}
                      </Link>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="ticker-skeleton"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="flex items-center gap-3 whitespace-nowrap min-w-0"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-neutral-700" />
                      <span className="h-3 w-40 rounded bg-neutral-800 animate-pulse" />
                    </motion.div>
                  )}
              </AnimatePresence>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-4 text-neutral-400">
            <button className="flex items-center gap-1 hover:text-white transition-colors" aria-label="Notificações">
              <Bell className="h-3 w-3" aria-hidden="true" /> Notificações
            </button>
          </div>
        </div>
      </div>

      {/* MAIN NAVBAR */}
      <div className="bg-white border-b border-neutral-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 sm:px-4 py-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center">
              <Link href="/" className="bg-neutral-950 p-1.5 rounded shadow-lg">
                <Image
                  src="/images/redevoce.png"
                  width={110}
                  height={110}
                  alt="Rede Você"
                  className="brightness-110 w-[86px] sm:w-[110px] h-auto"
                  priority
                />
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 rounded-full bg-neutral-50 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-all border border-neutral-200/50 w-10 h-10 sm:h-auto sm:w-auto px-0 sm:px-4 py-0 sm:py-2 justify-center"
              aria-label="Buscar notícias"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Buscar notícias...</span>
              <Kbd className="hidden md:inline-flex ml-2 bg-white border-neutral-200 text-[10px]">⌘K</Kbd>
            </button>

            <div className="h-6 w-px bg-neutral-100 mx-2 hidden sm:block" />

            <div className="ml-1 sm:ml-0">
              <UserStatus />
            </div>
          </div>
        </div>
      </div>

      {/* SUB NAV */}
      <nav className="bg-neutral-50/80 backdrop-blur-md border-b border-neutral-200/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-4 py-1">
          <div className="flex gap-1 overflow-x-auto py-1 -ml-1 pr-3 sm:ml-0 sm:pr-0">
              {[
              { name: "Últimas", tag: "" },
              { name: "VC TV", tag: "vc-tv" },
              { name: "PODCAST", tag: "podcast" },
              // { name: "Tecnologia", tag: "tecnologia" },
              // { name: "Cultura", tag: "cultura" },
              // { name: "Esportes", tag: "esportes" },
              // { name: "Saúde", tag: "saude" }
            ].map((cat) => (
              <button
                key={cat.name}
                onClick={() => {
                  const params = new URLSearchParams();
                  if (cat.tag) params.set("tag", cat.tag);
                  router.push(`/${params.toString() ? `?${params.toString()}` : ""}`);
                }}
                className={`px-3 py-1.5 text-[13px] font-bold transition-all rounded-md whitespace-nowrap ${
                  activeTag === cat.tag
                    ? "text-red-600 bg-red-50/50"
                    : "text-neutral-600 hover:text-black hover:bg-neutral-200/50"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div>
        <Progress
          aria-label="Progresso de leitura"
          value={scrollProgress}
          size="lg"
          className="w-full"
          classNames={{
            track: "h-2.5 rounded-none bg-neutral-200/80",
            indicator: "h-2.5 rounded-none bg-[var(--primary)]",
          }}
        />
      </div>

      {/* Search Overlay */}
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        locationLabel={currentLocation}
      />
    </header>
  );
}
