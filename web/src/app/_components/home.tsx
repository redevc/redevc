"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaRegClock } from "react-icons/fa";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { fetchNews } from "@/lib/api/news";
import type { Post } from "@/types/post";

const LIMIT = 12;

function timeAgo(date: Date, nowMs: number) {
  const diffMs = nowMs - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export function HomeClient() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const searchParams = useSearchParams();
  const tag = searchParams.get("tag") ?? undefined;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setPage(1);
    setPosts([]);
    setHasMore(true);
  }, [tag]);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchNews({ page, limit: LIMIT, tag: tag || undefined });
        if (cancel) return;
        setPosts((prev) => (page === 1 ? data : [...prev, ...data]));
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
  }, [page, tag]);

  const activeFeaturedList = useMemo(
    () =>
      posts.filter(
        (p) => p.isFeatured && p.featuredUntil && new Date(p.featuredUntil) > new Date(),
      ),
    [posts],
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

  const headline = useMemo(
    () => activeFeaturedList[headlineIndex] ?? posts[0],
    [activeFeaturedList, headlineIndex, posts],
  );
  const latestList = useMemo(() => posts.slice(0, 6), [posts]);
  const others = useMemo(() => (posts.length > 6 ? posts.slice(6) : posts), [posts]);
  const emptyMessage = tag ? "Nenhuma notícia para esta categoria." : "Nenhuma notícia publicada ainda.";

  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
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
                  <div className="bg-gray-200 h-64 w-full mb-4 rounded-2xl overflow-hidden">
                    {headline.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={headline.coverImageUrl}
                        alt={headline.title}
                        className="w-full h-full object-cover transition-transform duration-300"
                      />
                    ) : null}
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

        <aside className="border-l border-gray-200 pl-4">
          <h2 className="text-lg font-semibold mb-4">Últimas notícias</h2>
          <ul className="space-y-4">
            {latestList.map((post) => (
              <li key={post.id}>
                <a
                  href={`/news/${post.slug}`}
                  className="text-sm hover:underline block leading-snug line-clamp-2"
                >
                  {post.title}
                </a>
                <span className="text-xs text-gray-500">
                  {timeAgo(new Date(post.createdAt), now)}
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

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Outras notícias</h2>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {others.map((post) => (
            <article key={post.id}>
              <Link href={`/news/${post.slug}`} className="group block rounded-xl">
                <div className="bg-gray-200 h-28 w-full mb-2 rounded-xl overflow-hidden transition-colors">
                  {post.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.coverImageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <h4 className="text-sm font-semibold leading-snug line-clamp-2 transition-colors group-hover:text-orange-600">
                  {post.title}
                </h4>
                <span className="text-xs text-gray-500">
                  {timeAgo(new Date(post.createdAt), now)}
                </span>
              </Link>
            </article>
          ))}
          {others.length === 0 && !loading ? (
            <div className="text-sm text-gray-500">
              {error ? "Erro ao carregar notícias." : posts.length === 0 ? emptyMessage : "Sem mais notícias."}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
