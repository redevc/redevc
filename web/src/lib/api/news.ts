import type { News } from "@/types/news";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

type QueryValue = string | number | boolean | undefined;

type FetchOptions = RequestInit & { params?: Record<string, QueryValue> };

function buildUrl(path: string, params?: Record<string, QueryValue>) {
  const url = new URL(path, API_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function fetchJson<T>(path: string, options?: FetchOptions): Promise<T> {
  if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL não configurado");

  const { params, headers, ...init } = options ?? {};

  const res = await fetch(buildUrl(path, params), {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    const payload = await res.text();
    throw new Error(`Request failed ${res.status}: ${payload}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchNews(opts?: {
  status?: "draft" | "published";
  tag?: string;
  authorId?: string;
  page?: number;
  limit?: number;
  featuredOnly?: boolean;
}): Promise<News[]> {
  const { status = "published", tag, authorId, page = 1, limit = 10, featuredOnly } = opts ?? {};

  return fetchJson<News[]>("/news", {
    params: {
      status,
      tag,
      authorId,
      page,
      limit,
      featuredOnly,
    },
  });
}

export async function fetchTopNews(limit = 5): Promise<News[]> {
  return fetchNews({ status: "published", page: 1, limit });
}

export type NewsPreview = Pick<
  News,
  "id" | "slug" | "title" | "description" | "coverImageUrl" | "createdAt" | "status" | "tags"
>;

export async function searchNews(query: string, opts?: { limit?: number; status?: "draft" | "published" }): Promise<NewsPreview[]> {
  return fetchJson<NewsPreview[]>("/news/search", {
    params: {
      q: query,
      limit: opts?.limit ?? 10,
      status: opts?.status,
    },
  });
}

export type CreateNewsInput = {
  title: string;
  description: string;
  content: string;
  coverImageUrl?: string;
  tags?: string[];
  status?: "draft" | "published";
  isFeatured?: boolean;
  featuredUntil?: string | null;
};

export async function createNews(payload: CreateNewsInput): Promise<News> {
  return fetchJson<News>("/news", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
