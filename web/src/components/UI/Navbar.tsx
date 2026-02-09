"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Kbd } from "@heroui/react";
import {
  Search,
  X,
  Clock,
  TrendingUp,
  ChevronRight,
  Bell,
} from "lucide-react";

import { usePostSearch } from "@/lib/use-search";
import { fetchTopNews } from "@/lib/api/news";
import { Post } from "@/types/post";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  const { query, setQuery, results, loading, error } = usePostSearch();
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
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 bg-black/20 backdrop-blur-sm"
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
                              {result.description || "Visualizar post"}
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
  const [tickerPosts, setTickerPosts] = useState<Post[]>([]);
  const [tickerIndex, setTickerIndex] = useState(0);
  const activeTicker = tickerPosts.length
    ? tickerPosts[Math.min(tickerIndex, Math.max(0, tickerPosts.length - 1))]
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
        const posts = await fetchTopNews(8);
        const featured = posts.filter((p) => {
          if (!p.isFeatured) return false;
          if (!p.featuredUntil) return true;
          return new Date(p.featuredUntil) > new Date();
        });
        if (!cancel) setTickerPosts(featured);
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
    if (tickerPosts.length <= 1) return;

    const id = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerPosts.length);
    }, ROTATION_INTERVAL);

    return () => clearInterval(id);
  }, [tickerPosts.length]);

  return (
    <header className="relative left-0 z-50 w-full shadow-sm">
      {/* TOP STATUS BAR */}
      <div className="bg-neutral-950 text-white text-[11px] font-medium tracking-tight">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5">
          <div className="flex items-center gap-4 overflow-hidden">
            <div className="flex items-center gap-1.5 border-r border-neutral-800 pr-4">
              <Clock className="h-3 w-3 text-neutral-500" />
              <time className="text-neutral-400 uppercase">{formatDate(new Date())}</time>
            </div>

            <div className="relative h-5 overflow-hidden">
              <AnimatePresence mode="wait">
                  {activeTicker ? (
                    <motion.div
                      key={activeTicker.slug}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="flex items-center gap-3 whitespace-nowrap"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      <Link
                        href={`/news/${activeTicker.slug}`}
                        className="text-neutral-200 hover:text-white cursor-pointer transition-colors line-clamp-1"
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
                      className="flex items-center gap-3 whitespace-nowrap"
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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center">
              <Link href="/" className="bg-neutral-950 p-1.5 rounded shadow-lg">
                <Image
                  src="/images/redevoce.png"
                  width={110}
                  height={110}
                  alt="Rede Você"
                  className="brightness-110"
                  priority
                />
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 rounded-full bg-neutral-50 px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-all border border-neutral-200/50"
              aria-label="Buscar notícias"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Buscar notícias...</span>
              <Kbd className="hidden md:inline-flex ml-2 bg-white border-neutral-200 text-[10px]">⌘K</Kbd>
            </button>

            <div className="h-6 w-[1px] bg-neutral-100 mx-2 hidden sm:block" />
          </div>
        </div>
      </div>

      {/* SUB NAV */}
      <nav className="bg-neutral-50/80 backdrop-blur-md border-b border-neutral-200/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1">
          <div className="flex gap-1 overflow-x-auto py-1">
              {[
              { name: "Últimas", tag: "" },
              { name: "Política", tag: "politica" },
              { name: "Economia", tag: "economia" },
              { name: "Tecnologia", tag: "tecnologia" },
              { name: "Cultura", tag: "cultura" },
              { name: "Esportes", tag: "esportes" },
              { name: "Saúde", tag: "saude" }
            ].map((cat) => (
              <button
                key={cat.name}
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  if (cat.tag) {
                    params.set("tag", cat.tag);
                  } else {
                    params.delete("tag");
                  }
                  router.push(`${pathname}?${params.toString()}`);
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

      {/* Search Overlay */}
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        locationLabel={currentLocation}
      />
    </header>
  );
}
