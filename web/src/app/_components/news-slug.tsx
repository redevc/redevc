"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { addToast, Spinner } from "@heroui/react";

import { Post } from "@/types/post";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

type Props = {
  slug: string;
};

export function NewsSlugClient({ slug }: Props) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      if (!API_URL) {
        setError("API não configurada (NEXT_PUBLIC_API_URL ausente)");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/news/slug/${encodeURIComponent(slug)}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(
            res.status === 404
              ? "Notícia não encontrada."
              : `Erro ${res.status}: ${txt || "não foi possível carregar"}`,
          );
        }
        const data = (await res.json()) as Post;
        if (!cancel) setPost(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar notícia";
        if (!cancel) {
          setError(message);
          addToast({ title: "Erro", description: message, color: "danger" });
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    load();
    return () => {
      cancel = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 px-4 flex justify-center">
        <Spinner color="warning" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 px-4 text-center text-neutral-600">
        {error ?? "Notícia não encontrada."}
      </div>
    );
  }

  return (
    <article className="w-full max-w-4xl mx-auto py-10 px-4 space-y-6">
      {post.coverImageUrl ? (
        <div className="w-full rounded-2xl overflow-hidden bg-neutral-100">
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            width={1600}
            height={900}
            sizes="(min-width: 1024px) 960px, 100vw"
            className="w-full h-64 sm:h-96 object-cover"
            unoptimized
          />
        </div>
      ) : null}

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500 font-semibold">
          {post.tags?.[0] ?? "Geral"}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-neutral-900">{post.title}</h1>
        <p className="text-sm text-neutral-500">
          Publicado em {new Date(post.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </header>

      <p className="text-lg text-neutral-700 leading-relaxed whitespace-pre-wrap">
        {post.content}
      </p>
    </article>
  );
}
