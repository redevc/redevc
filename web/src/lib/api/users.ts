const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

type UpdateUserInput = {
  name?: string;
  username?: string;
  image?: string | null;
};

export type ResolvedAuthor = {
  id: string;
  name?: string;
  username?: string;
  image?: string | null;
  role?: string;
  slug: string;
};

export type ResolvedAuthorCandidate = {
  id: string;
  name?: string;
  username?: string;
  slug: string;
};

export type ResolveAuthorBySlugResult =
  | { ok: true; author: ResolvedAuthor }
  | { ok: false; status: 404; message: string }
  | { ok: false; status: 409; message: string; candidates: ResolvedAuthorCandidate[] };

const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL não configurado");

  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    const payload = await res.text();
    throw new Error(`Request failed ${res.status}: ${payload || res.statusText}`);
  }

  return res.json() as Promise<T>;
};

export const updateUser = (id: string, payload: UpdateUserInput) =>
  fetchJson<{ success: boolean; id: string }>(`/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const resolveAuthorBySlug = async (slug: string): Promise<ResolveAuthorBySlugResult> => {
  if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL não configurado");

  const res = await fetch(`${API_URL}/users/resolve/${encodeURIComponent(slug)}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (res.ok) {
    const data = (await res.json()) as ResolvedAuthor;
    return { ok: true, author: data };
  }

  if (res.status === 404) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, status: 404, message: payload?.message ?? "author not found" };
  }

  if (res.status === 409) {
    const payload = (await res.json().catch(() => null)) as {
      message?: string;
      candidates?: ResolvedAuthorCandidate[];
    } | null;
    return {
      ok: false,
      status: 409,
      message: payload?.message ?? "author name is ambiguous",
      candidates: payload?.candidates ?? [],
    };
  }

  const payload = await res.text();
  throw new Error(`Request failed ${res.status}: ${payload || res.statusText}`);
};
