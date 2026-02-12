const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

type UpdateUserInput = {
  name?: string;
  username?: string;
  image?: string | null;
};

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

