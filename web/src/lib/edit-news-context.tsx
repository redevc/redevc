"use client";

import { addToast } from "@heroui/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { News, NewsStatus } from "@/types/news";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

const EDITABLE_KEYS: (keyof EditableFields)[] = [
  "title",
  "description",
  "content",
  "coverImageUrl",
  "tags",
  "status",
  "isFeatured",
  "featuredUntil",
];

type EditableFields = Pick<
  News,
  "title" | "description" | "content" | "coverImageUrl" | "tags" | "status" | "isFeatured" | "featuredUntil"
>;

type Draft = EditableFields & { id: string };

type ContextValue = {
  news: News | null;
  draft: Draft | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  dirtyFields: (keyof EditableFields)[];
  error: string | null;
  lastSavedAt: number | null;
  updateField: <K extends keyof EditableFields>(key: K, value: EditableFields[K]) => void;
  setDraftFields: (fields: Partial<EditableFields>) => void;
  reset: () => void;
  save: () => Promise<News | null>;
  refresh: () => Promise<void>;
  slug: string | null;
};

const EditNewsContext = createContext<ContextValue | null>(null);

function extractEditable(news: News): Draft {
  return {
    id: news.id,
    title: news.title,
    description: news.description,
    content: news.content,
    coverImageUrl: news.coverImageUrl ?? "",
    tags: news.tags ?? [],
    status: news.status,
    isFeatured: news.isFeatured ?? false,
    featuredUntil: news.featuredUntil ?? undefined,
  };
}

function normalizeValue(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === "" || value === null || value === undefined) return null;
  return value;
}

function isDifferent(a: unknown, b: unknown) {
  return JSON.stringify(normalizeValue(a)) !== JSON.stringify(normalizeValue(b));
}

export function EditNewsProvider({ slug, children }: { slug: string | null; children: ReactNode }) {
  const [news, setNews] = useState<News | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!slug || !API_URL) {
      setNews(null);
      setDraft(null);
      setError(API_URL ? null : "API não configurada");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/news/slug/${encodeURIComponent(slug)}`, {
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erro ${res.status} ao carregar notícia`);
      }

      const data = (await res.json()) as News;
      setNews(data);
      setDraft(extractEditable(data));
      setLastSavedAt(Date.parse(data.updatedAt));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar notícia";
      if (controller.signal.aborted) return;
      setError(message);
      setNews(null);
      setDraft(null);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const dirtyFields = useMemo(() => {
    if (!news || !draft) return [] as (keyof EditableFields)[];
    return EDITABLE_KEYS.filter((key) => isDifferent(draft[key], news[key]));
  }, [draft, news]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirtyFields.length === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyFields.length]);

  const updateField = useCallback(<K extends keyof EditableFields>(key: K, value: EditableFields[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const setDraftFields = useCallback((fields: Partial<EditableFields>) => {
    setDraft((prev) => (prev ? { ...prev, ...fields } : prev));
  }, []);

  const reset = useCallback(() => {
    if (!news) return;
    setDraft(extractEditable(news));
    setError(null);
  }, [news]);

  const save = useCallback(async () => {
    if (!news || !draft || dirtyFields.length === 0 || !API_URL) return news;

    const payload: Partial<News> = {};
    for (const key of dirtyFields) {
      const value = draft[key];
      if (key === "coverImageUrl") {
        payload.coverImageUrl = value ? (value as string) : undefined;
      } else if (key === "tags") {
        payload.tags = Array.isArray(value) ? value : undefined;
      } else if (key === "featuredUntil") {
        payload.featuredUntil = value ? (value as string) : undefined;
      } else if (key === "status") {
        payload.status = value as NewsStatus;
      } else if (key === "isFeatured") {
        payload.isFeatured = Boolean(value);
      } else if (key === "title" || key === "description" || key === "content") {
        payload[key] = value as string;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/news/${news.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erro ${res.status} ao salvar`);
      }

      const updated = (await res.json()) as News;
      setNews(updated);
      setDraft(extractEditable(updated));
      setLastSavedAt(Date.parse(updated.updatedAt));
      addToast({ title: "Alterações salvas", description: "A notícia foi atualizada.", color: "success" });
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar alterações";
      setError(message);
      addToast({ title: "Erro ao salvar", description: message, color: "danger" });
      return null;
    } finally {
      setSaving(false);
    }
  }, [dirtyFields, draft, news]);

  const value = useMemo(
    () => ({
      news,
      draft,
      loading,
      saving,
      dirty: dirtyFields.length > 0,
      dirtyFields,
      error,
      lastSavedAt,
      updateField,
      setDraftFields,
      reset,
      save,
      refresh: load,
      slug: slug ?? null,
    }),
    [news, draft, loading, saving, dirtyFields, error, lastSavedAt, updateField, setDraftFields, reset, save, load, slug],
  );

  return <EditNewsContext.Provider value={value}>{children}</EditNewsContext.Provider>;
}

export function useEditNews() {
  return useContext(EditNewsContext);
}
