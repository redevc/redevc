"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type KeyboardEvent as InputKeyboardEvent,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  addToast,
  Spinner,
  Chip,
  Input,
  Textarea,
  Button,
  Tabs,
  Tab,
  Card,
  CardBody,
  Divider,
} from "@heroui/react";
import { Edit3 } from "lucide-react";
import { FaCheckCircle, FaLock } from "react-icons/fa";

import { MarkdownContent } from "@/components/MarkdownContent";
import { Comments } from "@/components/comments/Comments";
import { useEditNews } from "@/lib/edit-news-context";
import { auth } from "@/lib/auth";

import type { News } from "@/types/news";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

type Props = {
  slug: string;
  showComments?: boolean;
  requiredAuthorId?: string;
  unauthorizedMessage?: string;
  redirectDraftToEdit?: boolean;
};

export function NewsSlugClient({
  slug,
  showComments = true,
  requiredAuthorId,
  unauthorizedMessage = "Você não tem permissão para editar esta notícia.",
  redirectDraftToEdit = true,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = auth.useSession();
  const currentUserId = session?.user?.id as string | undefined;
  const edit = useEditNews();
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const editingTitleRef = useRef(false);
  const [tagInput, setTagInput] = useState("");
  const [news, setNews] = useState<News | null>(null);
  const [author, setAuthor] = useState<{
    id: string;
    name?: string;
    username?: string;
    image?: string | null;
    role?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasIncrementedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  const fetchAuthor = useCallback(async (authorId: string) => {
    const res = await fetch(`${API_URL}/users/${encodeURIComponent(authorId)}`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as typeof author;
    if (data) setAuthor(data);
  }, []);

  const incrementViews = useCallback(
    async (slugValue: string) => {
      if (hasIncrementedRef.current || !API_URL) return;

      const key = `news:viewed:${slugValue}`;
      const now = Date.now();
      const ttlMs = 24 * 60 * 60 * 1000;

      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const last = Number(stored);
          if (Number.isFinite(last) && now - last < ttlMs) return;
        }
      } catch (err) {
        console.warn("Não foi possível ler localStorage para views", err);
      }

      hasIncrementedRef.current = true;
      try {
        const res = await fetch(`${API_URL}/news/slug/${encodeURIComponent(slugValue)}/view`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { views?: number };
        if (typeof data.views === "number") {
          setNews((prev) => (prev ? { ...prev, views: data.views ?? prev.views } : prev));
          localStorage.setItem(key, String(now));
        }
      } catch (err) {
        console.error("Erro ao registrar visualização", err);
      }
    },
    [],
  );

  // permite contar novamente ao mudar de slug (respeitando TTL por slug no localStorage)
  useEffect(() => {
    hasIncrementedRef.current = false;
  }, [slug]);

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
        const data = (await res.json()) as News;
        if (!cancel) {
          setNews(data);
          if (data.authorId && !cancel) {
            fetchAuthor(data.authorId).catch((err) => {
              if (!cancel) console.error("Falha ao carregar autor", err);
            });
          }
          // incrementa views apenas para notícias publicadas
          const isOwner = !requiredAuthorId || data.authorId === requiredAuthorId;
          if (!cancel && data.status === "published" && isOwner) {
            incrementViews(data.slug).catch((err) => {
              if (!cancel) console.error("Falha ao incrementar views", err);
            });
          }
        }
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
  }, [slug, fetchAuthor, incrementViews, requiredAuthorId]);

  // se for rascunho e estamos na rota pública, redireciona para /edit/[slug]
  useEffect(() => {
    if (!news || news.status !== "draft" || !redirectDraftToEdit) return;
    // evita loop caso já esteja na rota de edição
    if (pathname?.startsWith("/edit/")) return;
    router.replace(`/edit/${news.slug}`);
  }, [news, redirectDraftToEdit, pathname, router]);

  const isEditRoute = pathname?.startsWith("/edit/");
  const titleValue = useMemo(() => {
    if (!news) return "";
    return isEditRoute && edit?.draft ? edit.draft.title : news.title;
  }, [isEditRoute, edit?.draft, news]);

  const contentValue = useMemo(() => {
    if (!news) return "";
    return isEditRoute && edit?.draft ? edit.draft.content : news.content;
  }, [isEditRoute, edit?.draft, news]);

  const tagsValue = useMemo(
    () => (isEditRoute && edit?.draft ? edit.draft.tags ?? [] : news?.tags ?? []),
    [isEditRoute, edit?.draft, news?.tags],
  );

  const placeCaretAtEnd = (el: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const handleTitleInput = (event: FormEvent<HTMLHeadingElement>) => {
    const node = event.currentTarget;
    if (node.innerText.startsWith(" ")) {
      node.innerText = node.innerText.trimStart();
      placeCaretAtEnd(node);
    }
  };

  const handleTitleBlur = async () => {
    if (!edit) return;
    editingTitleRef.current = false;
    const current = titleRef.current?.innerText.trim() ?? "";
    if (!current) return;
    if (current !== (news?.title ?? "")) {
      setNews((prev) => (prev ? { ...prev, title: current } : prev));
      edit.updateField("title", current);
    }
  };

  const handleTitleFocus = () => {
    editingTitleRef.current = true;
    const node = titleRef.current;
    if (node) placeCaretAtEnd(node);
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLHeadingElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  const handleTitlePaste = (event: ClipboardEvent<HTMLHeadingElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const currentStatus: News["status"] = (edit?.draft?.status ?? news?.status ?? "draft") as News["status"];

  const handleToggleStatus = async () => {
    if (!edit || !news) return;
    const next = currentStatus === "published" ? "draft" : "published";
    edit.updateField("status", next);
  };

  const isNotOwner = requiredAuthorId && news?.authorId !== requiredAuthorId;
  const isOwner = currentUserId && news?.authorId === currentUserId;

  useEffect(() => {
    if (editingTitleRef.current) return;
    const node = titleRef.current;
    if (!node) return;
    if (node.innerText !== titleValue) {
      node.innerText = titleValue;
    }
  }, [titleValue]);

  useEffect(() => {
    setTagInput("");
  }, [tagsValue]);

  const normalizeTag = (value: string) => value.trim().replace(/\s+/g, " ");

  const addTag = (raw: string) => {
    if (!edit) return;
    const tag = normalizeTag(raw);
    if (!tag) return;
    if (tagsValue.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setTagInput("");
      return;
    }
    edit.updateField("tags", [...tagsValue, tag]);
    setTagInput("");
  };

  const handleTagChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTagInput(event.target.value);
  };

  const handleTagKeyDown = (event: InputKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(tagInput);
    } else if (event.key === "Backspace" && tagInput === "" && tagsValue.length > 0) {
      event.preventDefault();
      edit?.updateField(
        "tags",
        tagsValue.slice(0, -1),
      );
    }
  };

  const handleTagBlur = () => {
    if (tagInput.trim()) addTag(tagInput);
  };

  const handleTagRemove = (tag: string) => {
    if (!edit) return;
    edit.updateField(
      "tags",
      tagsValue.filter((t) => t !== tag),
    );
  };

  const handleContentChange = (value: string) => {
    if (!edit) return;
    edit.updateField("content", value);
  };

  if (loading) {
    return (
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <section className="w-full max-w-4xl mx-auto min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center">
          <Spinner color="warning" />
        </section>
      </main>
    );
  }

  if (error || !news) {
    return (
      <section className="w-full max-w-4xl mx-auto min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center px-4 text-center text-neutral-600">
        {error ?? "Notícia não encontrada."}
      </section>
    );
  }

  if (isNotOwner) {
    return (
      <section className="w-full max-w-4xl mx-auto min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center px-4 text-center text-neutral-600">
        {unauthorizedMessage}
      </section>
    );
  }

  return (
    <article className="w-full max-w-4xl mx-auto py-10 px-4 space-y-6">
      {news.coverImageUrl ? (
        <div className="w-full rounded-2xl overflow-hidden bg-neutral-100">
          <Image
            src={news.coverImageUrl}
            alt={news.title}
            width={1600}
            height={900}
            sizes="(min-width: 1024px) 960px, 100vw"
            className="w-full h-56 sm:h-96 object-cover"
            unoptimized
          />
        </div>
      ) : null}

      <header className="space-y-2 border-b border-neutral-200 pb-4">
        {isEditRoute && edit ? (
          <div className="flex flex-col gap-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-neutral-500 font-semibold">
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white/90 px-3 py-2 shadow-inner focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-200/70">
              {tagsValue.map((tag) => (
                <Chip
                  key={tag}
                  variant="flat"
                  color="warning"
                  radius="sm"
                  onClose={() => handleTagRemove(tag)}
                  classNames={{
                    base: "text-xs font-semibold uppercase tracking-[0.12em] rounded-md border border-transparent hover:border-orange-200",
                    closeButton: "text-orange-700",
                  }}
                >
                  {tag}
                </Chip>
              ))}
              <Input
                aria-label="Adicionar tag"
                variant="bordered"
                color="warning"
                radius="sm"
                size="sm"
                value={tagInput}
                onChange={handleTagChange}
                onKeyDown={handleTagKeyDown}
                onBlur={handleTagBlur}
                placeholder={tagsValue.length === 0 ? "Adicionar tag e tecle Enter" : "Nova tag"}
                className="min-w-40 flex-1"
                classNames={{
                  input: "text-sm",
                  inputWrapper:
                    "bg-white border-0 hover:border-0",
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-semibold text-orange-500">
            {(tagsValue.length > 0 ? tagsValue : ["Geral"]).map((tag) => (
              <span key={tag} className="px-2 py-1 bg-orange-50 rounded-full text-orange-600">
                {tag}
              </span>
            ))}
          </div>
        )}
        {isEditRoute && edit ? (
          <button
            type="button"
            onClick={handleToggleStatus}
            className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition ${
              currentStatus === "published"
                ? "bg-green-50 text-green-700 ring-1 ring-green-200 hover:bg-green-100"
                : "bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
            }`}
          >
            {currentStatus === "published" ? (
              <>
                <FaCheckCircle size={12} />
                Público
              </>
            ) : (
              <>
                <FaLock size={12} />
                Privado (rascunho)
              </>
            )}
          </button>
        ) : null}
        <h1
          className={`text-3xl sm:text-4xl font-bold leading-tight text-neutral-900 ${
            isEditRoute && edit
              ? "cursor-text -mx-1 px-1 rounded-md outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 hover:bg-orange-50/30 transition"
              : ""
          }`}
          contentEditable={isEditRoute && !!edit}
          suppressContentEditableWarning
          ref={titleRef}
          onInput={handleTitleInput}
          onBlur={handleTitleBlur}
          onFocus={handleTitleFocus}
          onKeyDown={handleTitleKeyDown}
          onPaste={handleTitlePaste}
          role={isEditRoute && edit ? "textbox" : undefined}
          aria-label={isEditRoute && edit ? "Título da notícia (clique para editar)" : "Título da notícia"}
        >
          {titleValue}
        </h1>
        <div className="text-sm text-neutral-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-0">
          <div className="flex items-center gap-3 text-neutral-700">
            {author ? (
              <>
                {author.image ? (
                  <Image
                    src={author.image}
                    alt={author.name ?? author.username ?? "Autor"}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover border border-neutral-200"
                  />
                ) : (
                  <span className="h-10 w-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-semibold text-neutral-600">
                    {(author.name ?? author.username ?? "?").slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-neutral-900">
                    {author.name ?? author.username ?? "Autor"}
                  </span>
                  {author.username ? (
                    <span className="text-xs text-neutral-500">@{author.username}</span>
                  ) : null}
                </div>
              </>
            ) : (
              <span className="text-xs text-neutral-500">Autor não informado</span>
            )}
          </div>
          <span className="text-xs sm:text-sm text-neutral-500 sm:text-right">
            Publicado em
            {" "}
            {new Date(news.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
            {typeof news.views === "number" ? ` · ${news.views} visualizações` : null}
          </span>
        </div>
      </header>

      {isEditRoute && edit ? (
        <section className="space-y-3">
          <Tabs
            aria-label="Edição da notícia"
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as "edit" | "preview")}
            color="primary"
            variant="underlined"
            classNames={{
              tab: "text-sm font-semibold",
              cursor: "bg-[var(--primary)]/80",
            }}
          >
            <Tab key="edit" title="Conteúdo">
              <Card shadow="sm" radius="lg" className="bg-white/90">
                <CardBody className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500 font-semibold">Conteúdo</p>
                  <p className="text-xs text-neutral-500">Markdown suportado. Use Enter ou Shift+Enter para quebrar linhas.</p>
                  <Textarea
                    aria-label="Conteúdo da notícia"
                  variant="bordered"
                  color="warning"
                  radius="md"
                  minRows={12}
                  value={contentValue}
                  onChange={(e) => handleContentChange(e.target.value)}
                  classNames={{
                    input: "text-sm leading-6 resize-y min-h-[280px] border-neutral-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/0 transition rounded-md",
                    inputWrapper:
                      "bg-white shadow-none border-0 hover:border-0",
                  }}
                />
              </CardBody>
            </Card>
            </Tab>
            <Tab key="preview" title="Pré-visualização">
              <Card shadow="sm" radius="lg" className="bg-white/90">
                <CardBody className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 font-semibold">Pré-visualização</p>
                    <Divider className="flex-1 ml-3" />
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white/80 p-4">
                    <MarkdownContent content={contentValue} />
                  </div>
                </CardBody>
              </Card>
            </Tab>
          </Tabs>
        </section>
      ) : (
        <MarkdownContent content={news.content} />
      )}

      <footer className="pt-6">
        <div className="rounded-xl border border-neutral-200 bg-white/70 p-4 flex items-center gap-4 shadow-sm">
          {author?.image ? (
            <Image
              src={author.image}
              alt={author.name ?? author.username ?? "Autor"}
              width={56}
              height={56}
              className="h-14 w-14 rounded-full object-cover border border-neutral-200"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-semibold text-neutral-700">
              {(author?.name ?? author?.username ?? "?").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-base font-semibold text-neutral-900">
              {author ? author.name ?? author.username ?? "Autor" : "Autor não informado"}
            </p>
            <p className="text-sm text-neutral-500">
              {author?.username ? `@${author.username}` : author?.role ?? "Colaborador"}
            </p>
          </div>
        </div>
      </footer>

      {showComments ? <Comments slug={slug} newsId={news.id} /> : null}

      {isOwner && !isEditRoute ? (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            as={Link}
            href={`/edit/${news.slug}`}
            color="primary"
            variant="shadow"
            startContent={<Edit3 size={16} />}
            className="shadow-lg"
          >
            Editar notícia
          </Button>
        </div>
      ) : null}
    </article>
  );
}
