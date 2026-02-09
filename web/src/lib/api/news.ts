import { Post } from "@/types/post";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

type QueryValue = string | number | boolean | undefined;

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

async function fetchJson<T>(path: string, params?: Record<string, QueryValue>): Promise<T> {
  if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL não configurado");

  const res = await fetch(buildUrl(path, params), {
    cache: "no-store",
    credentials: "include",
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
}): Promise<Post[]> {
  const { status = "published", tag, authorId, page = 1, limit = 10, featuredOnly } = opts ?? {};

  return fetchJson<Post[]>("/news", {
    status,
    tag,
    authorId,
    page,
    limit,
    featuredOnly,
  });
}

export async function fetchTopNews(limit = 5): Promise<Post[]> {
  return fetchNews({ status: "published", page: 1, limit });
}

export type PostPreview = Pick<
  Post,
  "id" | "slug" | "title" | "description" | "coverImageUrl" | "createdAt" | "status" | "tags"
>;

export async function searchNews(query: string, opts?: { limit?: number; status?: "draft" | "published" }): Promise<PostPreview[]> {
  return fetchJson<PostPreview[]>("/news/search", {
    q: query,
    limit: opts?.limit ?? 10,
    status: opts?.status,
  });
}

export type CreatePostInput = {
  title: string;
  description: string;
  content: string;
  coverImageUrl?: string;
  tags?: string[];
  status?: "draft" | "published";
  isFeatured?: boolean;
  featuredUntil?: string | null;
};

export async function createNews(payload: CreatePostInput): Promise<Post> {
  return fetchJson<Post>("/news", payload as unknown as Record<string, QueryValue>);
}
