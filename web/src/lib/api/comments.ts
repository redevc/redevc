const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export type Comment = {
  id: string;
  newsId: string;
  threadId: string;
  replyTo?: string | null;
  message: string;
  name: string;
  email?: string | null;
  site?: string | null;
  userId?: string | null;
  userImage?: string | null;
  token?: string | null;
  createdAt: string;
};

type CommentCreate = {
  newsId: string;
  replyTo?: string | null;
  message: string;
  token?: string;
};

type CommentQuery = {
  newsId?: string;
  threadId?: string;
  limit?: number;
  offset?: number;
};

type CommentsResponse = {
  data: Comment[];
  total: number;
  limit: number;
  offset: number;
};

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

async function fetchJson<T>(
  path: string,
  options?: RequestInit & { params?: Record<string, QueryValue> }
): Promise<T> {
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

/**
 * Buscar comentários por newsId ou threadId
 */
export async function fetchComments(query: CommentQuery): Promise<CommentsResponse> {
  return fetchJson<CommentsResponse>("/comments", {
    params: query as Record<string, QueryValue>,
  });
}

/**
 * Criar um novo comentário
 */
export async function createComment(data: CommentCreate): Promise<{ data: Comment; message: string }> {
  return fetchJson<{ data: Comment; message: string }>("/comments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Deletar um comentário e suas respostas
 */
export async function deleteComment(id: string, token?: string): Promise<{ message: string }> {
  return fetchJson<{ message: string }>(`/comments/${id}`, {
    method: "DELETE",
    body: token ? JSON.stringify({ token }) : undefined,
  });
}
