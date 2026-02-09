import { useEffect, useRef, useState } from "react";
import { searchNews, type PostPreview } from "./api/news";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

export function usePostSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PostPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();

    if (q.length < MIN_CHARS) {
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchNews(q, { limit: 10 });
        if (!controller.signal.aborted) setResults(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Erro na busca";
        setError(message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [query]);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
  };
}
