"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchNews } from "@/lib/api/news";
import {
  resolveAuthorBySlug,
  type ResolvedAuthor,
  type ResolvedAuthorCandidate,
} from "@/lib/api/users";
import type { News } from "@/types/news";

const PAGE_SIZE = 10;
const MOST_READ_LIMIT = 5;

type ResolveStatus = "loading" | "ready" | "not-found" | "ambiguous" | "error";

const formatPublishedAt = (iso: string) => {
  const date = new Date(iso);
  const day = date.toLocaleDateString("pt-BR");
  const hour = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day} | ${hour}`;
};

const getNewsSectionLabel = (news: News) => news.tags?.[0] ?? "Geral";

export function AuthorNameClient({ name }: { name: string }) {
  const [resolveStatus, setResolveStatus] = useState<ResolveStatus>("loading");
  const [resolveMessage, setResolveMessage] = useState<string | null>(null);
  const [ambiguousCandidates, setAmbiguousCandidates] = useState<ResolvedAuthorCandidate[]>([]);
  const [author, setAuthor] = useState<ResolvedAuthor | null>(null);
  const [authorNews, setAuthorNews] = useState<News[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authorNewsError, setAuthorNewsError] = useState<string | null>(null);
  const [mostRead, setMostRead] = useState<News[]>([]);
  const [loadingMostRead, setLoadingMostRead] = useState(false);
  const [mostReadError, setMostReadError] = useState<string | null>(null);

  const authorDisplayName = useMemo(
    () => author?.name ?? author?.username ?? name.replace(/-/g, " "),
    [author, name],
  );

  const loadAuthorNews = useCallback(
    async (
      authorId: string,
      nextPage: number,
      mode: "replace" | "append",
      shouldIgnore?: () => boolean,
    ) => {
      if (mode === "replace") {
        setLoadingNews(true);
        setAuthorNewsError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const data = await fetchNews({
          status: "published",
          authorId,
          sortBy: "recent",
          page: nextPage,
          limit: PAGE_SIZE,
        });

        if (shouldIgnore?.()) return;
        setAuthorNews((prev) => (mode === "replace" ? data : [...prev, ...data]));
        setPage(nextPage);
        setHasMore(data.length === PAGE_SIZE);
      } catch (err) {
        if (shouldIgnore?.()) return;
        const message = err instanceof Error ? err.message : "Erro ao carregar textos do autor";
        setAuthorNewsError(message);
        if (mode === "replace") {
          setAuthorNews([]);
          setHasMore(false);
        }
      } finally {
        if (shouldIgnore?.()) return;
        if (mode === "replace") setLoadingNews(false);
        else setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setResolveStatus("loading");
      setResolveMessage(null);
      setAmbiguousCandidates([]);
      setAuthor(null);
      setAuthorNews([]);
      setPage(1);
      setHasMore(false);
      setAuthorNewsError(null);
      setMostRead([]);
      setMostReadError(null);

      setLoadingMostRead(true);
      fetchNews({
        status: "published",
        sortBy: "views",
        page: 1,
        limit: MOST_READ_LIMIT,
      })
        .then((data) => {
          if (!cancelled) setMostRead(data);
        })
        .catch((err) => {
          if (!cancelled) {
            setMostReadError(err instanceof Error ? err.message : "Erro ao carregar mais lidas");
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingMostRead(false);
        });

      try {
        const resolved = await resolveAuthorBySlug(name);
        if (cancelled) return;

        if (!resolved.ok) {
          if (resolved.status === 404) {
            setResolveStatus("not-found");
            setResolveMessage("Autor não encontrado.");
            return;
          }

          setResolveStatus("ambiguous");
          setResolveMessage("Nome de autor ambíguo.");
          setAmbiguousCandidates(resolved.candidates);
          return;
        }

        setAuthor(resolved.author);
        setResolveStatus("ready");
        await loadAuthorNews(resolved.author.id, 1, "replace", () => cancelled);
      } catch (err) {
        if (cancelled) return;
        setResolveStatus("error");
        setResolveMessage(err instanceof Error ? err.message : "Erro ao resolver autor");
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadAuthorNews, name]);

  const handleLoadMore = async () => {
    if (!author || loadingMore || loadingNews || !hasMore) return;
    await loadAuthorNews(author.id, page + 1, "append");
  };

  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-8">
        <section className="min-w-0">
          <header className="mb-8">
            <p className="text-sm text-neutral-500 mb-2">Você está em</p>
            <h1 className="text-2xl sm:text-4xl font-bold leading-tight text-neutral-900">
              <span className="text-primary mr-2">→</span>
              Notícias publicadas por:
              {" "}
              <span className="text-primary">{authorDisplayName}</span>
            </h1>
          </header>

          {resolveStatus === "loading" ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
              Carregando autor...
            </div>
          ) : null}

          {resolveStatus === "not-found" ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
              {resolveMessage ?? "Autor não encontrado."}
            </div>
          ) : null}

          {resolveStatus === "error" ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
              {resolveMessage ?? "Não foi possível carregar a página do autor."}
            </div>
          ) : null}

          {resolveStatus === "ambiguous" ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <p className="text-sm text-neutral-700">
                {resolveMessage ?? "Nome ambíguo. Mais de um autor corresponde a este slug."}
              </p>
              <ul className="mt-4 space-y-2">
                {ambiguousCandidates.map((candidate) => (
                  <li
                    key={candidate.id}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700"
                  >
                    <span className="font-semibold text-neutral-900">
                      {candidate.name ?? candidate.username ?? candidate.id}
                    </span>
                    {candidate.username ? (
                      <span className="text-neutral-500"> @{candidate.username}</span>
                    ) : null}
                    <span className="ml-2 text-xs text-neutral-500">({candidate.id})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {resolveStatus === "ready" ? (
            <div>
              {loadingNews && authorNews.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
                  Carregando textos...
                </div>
              ) : null}

              {!loadingNews && authorNewsError ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
                  {authorNewsError}
                </div>
              ) : null}

              {!loadingNews && !authorNewsError && authorNews.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
                  Este autor ainda não possui textos publicados.
                </div>
              ) : null}

              {authorNews.length > 0 ? (
                <div className="border-t border-neutral-200">
                  {authorNews.map((newsItem) => (
                    <article key={newsItem.id} className="border-b border-neutral-200 py-7">
                      <Link
                        href={`/news/${newsItem.slug}`}
                        className="group grid grid-cols-1 sm:grid-cols-[340px_minmax(0,1fr)] gap-5"
                      >
                        <div className="relative overflow-hidden rounded-lg bg-neutral-100 min-h-48">
                          <span className="absolute left-0 top-0 z-10 h-2.5 w-12 rounded-br-md bg-primary" />
                          {newsItem.coverImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={newsItem.coverImageUrl}
                              alt={newsItem.title}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xl font-medium text-neutral-400">
                            {getNewsSectionLabel(newsItem)}
                          </p>
                          <h2 className="mt-1 text-2xl font-bold leading-tight text-neutral-900 transition-colors group-hover:text-primary">
                            {newsItem.title}
                          </h2>
                          <div className="mt-6 inline-flex items-center gap-2 text-sm text-neutral-500">
                            <Clock3 className="h-4 w-4 text-primary" />
                            <span>{formatPublishedAt(newsItem.createdAt)}</span>
                          </div>
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
              ) : null}

              {authorNews.length > 0 && hasMore ? (
                <div className="pt-6">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center justify-center rounded-lg border border-primary/40 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                  >
                    {loadingMore ? "Carregando..." : "Carregar mais"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className="min-w-0">
          <h2 className="text-3xl font-bold text-primary mb-4">Mais lidas</h2>
          {loadingMostRead ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
              Carregando...
            </div>
          ) : null}
          {!loadingMostRead && mostReadError ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
              {mostReadError}
            </div>
          ) : null}
          {!loadingMostRead && !mostReadError && mostRead.length > 0 ? (
            <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
              {mostRead.map((newsItem, index) => (
                <li key={newsItem.id} className="py-4">
                  <Link
                    href={`/news/${newsItem.slug}`}
                    className="group grid grid-cols-[120px_minmax(0,1fr)] gap-3"
                  >
                    <div className="relative h-24 overflow-hidden rounded-lg bg-neutral-100">
                      <span className="absolute left-1.5 top-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      {newsItem.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={newsItem.coverImageUrl}
                          alt={newsItem.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <p className="text-base font-semibold leading-snug text-neutral-900 transition-colors group-hover:text-primary">
                      {newsItem.title}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {!loadingMostRead && !mostReadError && mostRead.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhuma notícia disponível.</p>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
