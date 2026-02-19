"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaRegClock } from "react-icons/fa";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, Tab } from "@heroui/react";
import { FiTrendingUp, FiHeart, FiGlobe, FiHome } from "react-icons/fi";

import { fetchNews } from "@/lib/api/news";
import type { News } from "@/types/news";
import { slugify } from "@/utils/slugify";

const LIMIT = 12;
const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

function timeAgo(date: Date, nowMs: number) {
  const diffMs = nowMs - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

type AuthorInfo = {
  name?: string;
  username?: string;
  image?: string | null;
  role?: string;
};

export function HomeClient() {
  const [news, setNews] = useState<News[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [authorMap, setAuthorMap] = useState<Record<string, AuthorInfo>>({});
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tagParam = searchParams.get("tag") ?? undefined;

  const normalizeTag = (value?: string | null) =>
    (value ?? "")
      .normalize("NFD") // remove acentos
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "") // ignora traços, espaços, pontuação
      .toLowerCase();

  const TAG_TABS = [
    { key: "all", label: "Últimas", icon: <FiHome />, value: undefined },
    { key: "economia", label: "Economia", icon: <FiTrendingUp />, value: "economia" },
    { key: "saude", label: "Saúde", icon: <FiHeart />, value: "saude" },
    { key: "politica", label: "Política", icon: <FiGlobe />, value: "politica" },
  ] as const;

  const matchedTab = TAG_TABS.find(
    (t) =>
      normalizeTag(t.key) === normalizeTag(tagParam) ||
      normalizeTag(t.value) === normalizeTag(tagParam),
  );

  const selectedTabKey = matchedTab?.key ?? "all";
  const activeTagValue = matchedTab?.value ?? (tagParam || undefined);
  const activeTagNormalized = useMemo(
    () => (activeTagValue ? normalizeTag(activeTagValue) : undefined),
    [activeTagValue],
  );

  const handleTabChange = (key: string | number) => {
    const match = TAG_TABS.find((t) => t.key === key);
    const params = new URLSearchParams(searchParams.toString());
    if (!match || !match.key || match.key === "all") params.delete("tag");
    else params.set("tag", String(match.key));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setPage(1);
    setNews([]);
    setHasMore(true);
  }, [activeTagNormalized]);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchNews({ page, limit: LIMIT, tag: activeTagNormalized });
        if (cancel) return;
        setNews((prev) => (page === 1 ? data : [...prev, ...data]));
        setHasMore(data.length === LIMIT);
      } catch (err) {
        console.error(err);
        if (!cancel) {
          setError(err instanceof Error ? err.message : "Erro ao carregar notícias");
          setHasMore(false);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    load();
    return () => {
      cancel = true;
    };
  }, [page, activeTagNormalized]);

  const activeFeaturedList = useMemo(
    () =>
      news.filter(
        (p) => p.isFeatured && p.featuredUntil && new Date(p.featuredUntil) > new Date(),
      ),
    [news],
  );

  useEffect(() => {
    setHeadlineIndex(0);
  }, [activeFeaturedList.length]);

  useEffect(() => {
    if (activeFeaturedList.length <= 1) return;
    const id = setInterval(
      () => setHeadlineIndex((prev) => (prev + 1) % activeFeaturedList.length),
      15000,
    );
    return () => clearInterval(id);
  }, [activeFeaturedList.length]);

  useEffect(() => {
    if (!API_URL) return;
    const ids = Array.from(new Set(news.map((n) => n.authorId).filter(Boolean) as string[]));
    const missing = ids.filter((id) => !authorMap[id]);
    if (!missing.length) return;

    let cancel = false;
    (async () => {
      try {
        const fetched = await Promise.all(
          missing.map(async (id) => {
            const res = await fetch(`${API_URL}/users/${encodeURIComponent(id)}`, {
              cache: "no-store",
              credentials: "include",
            });
            if (!res.ok) return null;
            const data = (await res.json()) as { name?: string; username?: string; image?: string | null; role?: string };
            return { id, ...data };
          }),
        );
        if (cancel) return;
        setAuthorMap((prev) => {
          const next = { ...prev };
          fetched.forEach((item) => {
            if (item?.id) {
              next[item.id] = {
                name: item.name ?? item.username ?? item.id,
                username: item.username,
                image: item.image,
                role: item.role,
              };
            }
          });
          return next;
        });
      } catch (err) {
        console.error("Erro ao carregar autores", err);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [news, authorMap]);

  const headline = useMemo(
    () => activeFeaturedList[headlineIndex] ?? news[0],
    [activeFeaturedList, headlineIndex, news],
  );
  const latestList = useMemo(() => news.slice(0, 6), [news]);
  const others = useMemo(() => {
    const remaining = news.length > 6 ? news.slice(6) : news;
    if (!activeTagNormalized) return remaining;
    return remaining.filter((n) =>
      (n.tags ?? []).some((t) => normalizeTag(t) === activeTagNormalized),
    );
  }, [news, activeTagNormalized]);
  const emptyMessage = activeTagValue ? "Nenhuma notícia para esta categoria." : "Nenhuma notícia publicada ainda.";

  const renderAuthor = (authorId?: string) => {
    if (!authorId) return null;
    const info = authorMap[authorId];
    const display = info?.name ?? info?.username ?? "Autor";
    const authorSlug = slugify(info?.name ?? info?.username ?? "");
    const authorHref = authorSlug ? `/author/${encodeURIComponent(authorSlug)}` : null;
    return (
      <span className="relative inline-flex items-center group/author">
        {authorHref ? (
          <Link href={authorHref} className="font-semibold text-gray-700 group-hover/author:text-primary transition-colors">
            {display}
          </Link>
        ) : (
          <span className="font-semibold text-gray-700 group-hover/author:text-primary transition-colors">
            {display}
          </span>
        )}
        <div className="absolute left-0 top-full mt-2 hidden group-hover/author:flex">
          <div className="rounded-xl border border-neutral-200 bg-white shadow-lg p-3 w-56 flex gap-3 pointer-events-none">
            {info?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={info.image}
                alt={display}
                className="h-12 w-12 rounded-full object-cover border border-neutral-200"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-semibold text-neutral-700">
                {display.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 line-clamp-1">{display}</p>
              {info?.username ? (
                <p className="text-xs text-neutral-500 line-clamp-1">@{info.username}</p>
              ) : null}
              {info?.role ? (
                <p className="text-xs text-neutral-500 line-clamp-1">{info.role}</p>
              ) : null}
            </div>
          </div>
        </div>
      </span>
    );
  };

  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Manchete principal + últimas */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-2"
        >
          <AnimatePresence mode="wait">
            {headline ? (
              <motion.div
                key={headline.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <Link href={`/news/${headline.slug}`} className="block group">
                  <div className="bg-gray-200 h-56 sm:h-64 w-full mb-4 rounded-2xl overflow-hidden">
                    {headline.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={headline.coverImageUrl}
                        alt={headline.title}
                        className="w-full h-full object-cover transition-transform duration-300"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-600">
                    {(headline.tags && headline.tags.length > 0 ? headline.tags : ["Geral"]).map((t) => (
                      <span key={t} className="px-2 py-1 bg-orange-50 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
                    {headline.title}
                  </h1>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                    {headline.description}
                  </p>
                </Link>
                <div className="flex items-center text-xs text-gray-500 gap-2">
                  <FaRegClock />
                  <span>{timeAgo(new Date(headline.createdAt), now)}</span>
                  <span className="text-gray-400">•</span>
                  {renderAuthor(headline.authorId)}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="space-y-4"
              >
                <div className="bg-gray-200 h-64 w-full rounded-2xl animate-pulse" />
                <div className="bg-gray-200 h-4 w-3/4 rounded animate-pulse" />
                <div className="bg-gray-200 h-3 w-1/2 rounded animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.article>

        {/* Últimas notícias */}
        <aside className="mt-6 border-t border-gray-200 pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
          <h2 className="text-lg font-semibold mb-4">Últimas notícias</h2>
          <ul className="space-y-4">
            {latestList.map((newsItem) => (
              <li key={newsItem.id}>
                <Link
                  href={`/news/${newsItem.slug}`}
                  className="text-sm hover:underline block leading-snug line-clamp-2"
                >
                  {newsItem.title}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-orange-600">
                  {(newsItem.tags && newsItem.tags.length > 0 ? newsItem.tags : ["Geral"]).map((t) => (
                    <span key={t} className="px-2 py-[2px] bg-orange-50 rounded-full text-orange-600">
                      {t}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  {renderAuthor(newsItem.authorId)} • {timeAgo(new Date(newsItem.createdAt), now)}
                </span>
              </li>
            ))}
            {loading && latestList.length === 0 ? (
              <li className="text-sm text-gray-400">Carregando...</li>
            ) : null}
            {!loading && latestList.length === 0 && !headline ? (
              <li className="text-sm text-gray-500">
                {error ? "Erro ao carregar notícias." : emptyMessage}
              </li>
            ) : null}
          </ul>
        </aside>
      </section>

      {/* Outras notícias */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 rounded-full bg-gradient-to-b from-orange-400 via-red-500 to-pink-500" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-400">{news.length} {news.length === 1 ? "notícia" : "notícias"}</p>
              <h3 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
                Outras notícias
                {/* <span className="text-sm font-normal text-gray-500">
                  {news.length} {news.length === 1 ? "notícia" : "notícias"}
                </span> */}

              </h3>
            </div>
          </div>
          {hasMore ? (
            <button
              className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading}
            >
              {loading ? "Carregando..." : "Carregar mais"}
            </button>
          ) : null}
        </div>
        <div className="mb-4 -mx-1 sm:mx-0 overflow-x-auto">
          <div className="min-w-full px-1 sm:px-0">
          <Tabs
            aria-label="Filtrar notícias por categoria"
            selectedKey={selectedTabKey}
            onSelectionChange={handleTabChange}
            color="warning"
            variant="underlined"
            classNames={{
              tabList: "gap-3 border-b border-gray-200",
              tab: "px-0 data-[selected=true]:text-orange-600",
            }}
          >
            {TAG_TABS.map((t) => (
              <Tab
                key={t.key}
                title={
                  <div className="flex items-center gap-1.5 text-sm">
                    {t.icon}
                    <span>{t.label}</span>
                  </div>
                }
              />
            ))}
          </Tabs>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-7">
          {others.map((newsItem) => (
            <article key={newsItem.id}>
              <Link
                href={`/news/${newsItem.slug}`}
                className="group block rounded-xl"
              >
                <div className="bg-gray-200 h-32 sm:h-36 w-full mb-3 rounded-xl overflow-hidden transition-colors">
                  {newsItem.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={newsItem.coverImageUrl}
                      alt={newsItem.title}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <h4 className="text-[15px] font-semibold leading-snug line-clamp-2 transition-colors group-hover:text-orange-600">
                  {newsItem.title}
                </h4>
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {(newsItem.tags && newsItem.tags.length > 0 ? newsItem.tags : ["Geral"]).map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-600 bg-orange-50 px-2 py-[2px] rounded-full"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  {renderAuthor(newsItem.authorId)}
                  <span>• {timeAgo(new Date(newsItem.createdAt), now)}</span>
                </div>
              </Link>
            </article>
          ))}
          {others.length === 0 && !loading ? (
            <div className="text-sm text-gray-500">
              {error ? "Erro ao carregar notícias." : news.length === 0 ? emptyMessage : "Sem mais notícias."}
            </div>
          ) : null}
        </div>
      </section>

      {/* <HomeVideos /> */}
    </main>
  );
}
