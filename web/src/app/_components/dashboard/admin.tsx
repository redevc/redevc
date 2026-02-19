"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { addToast, Tabs, Tab } from "@heroui/react";
import { notFound, useRouter } from "next/navigation";

import { auth } from "@/lib/auth";
import { createNews, fetchNews } from "@/lib/api/news";
import { AudioUploadPanel } from "@/components/editor/AudioUploadPanel";
import type { News, NewsStatus } from "@/types/news";
import { isPublisherRole } from "@/utils/roles";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const normalizeTag = (value: string) => value.trim().replace(/\s+/g, " ");

const parseTags = (raw: string) => {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const part of raw.split(",")) {
    const tag = normalizeTag(part);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  return tags;
};

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const appendMarkdownToken = (content: string, token: string) => {
  const base = content.trimEnd();
  if (!base) return token;
  return `${base}\n\n${token}`;
};

const parseCreateErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    if (error.message.includes("403")) return "Você não tem permissão para criar notícias.";
    if (error.message.includes("400") || error.message.includes("422")) {
      return "Dados inválidos. Revise os campos e tente novamente.";
    }

    const payload = error.message.match(/\{.*\}$/)?.[0];
    if (payload) {
      try {
        const parsed = JSON.parse(payload) as { message?: string };
        if (parsed.message) return parsed.message;
      } catch {
        return error.message;
      }
    }

    return error.message;
  }

  return "Não foi possível criar a notícia. Tente novamente.";
};

const parseUnknownErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const maybeError = error as { message?: unknown; error?: unknown };
    if (typeof maybeError.message === "string") return maybeError.message;
    if (typeof maybeError.error === "string") return maybeError.error;
  }
  return fallback;
};

export function AdminDashboardClient() {
  const router = useRouter();
  const { data: session, isPending } = auth.useSession();
  const [published, setPublished] = useState<News[]>([]);
  const [drafts, setDrafts] = useState<News[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const user = session?.user;
  const userId = user?.id as string | undefined;
  const isAdmin = isPublisherRole(user?.role);
  const [profileName, setProfileName] = useState(user?.name ?? "");
  const [profileImage, setProfileImage] = useState(user?.image ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createContent, setCreateContent] = useState("");
  const [createCoverImageUrl, setCreateCoverImageUrl] = useState("");
  const [createTags, setCreateTags] = useState("");
  const [createStatus, setCreateStatus] = useState<NewsStatus>("draft");
  const [createIsFeatured, setCreateIsFeatured] = useState(false);
  const [createFeaturedUntil, setCreateFeaturedUntil] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createContentToolTab, setCreateContentToolTab] = useState<"text" | "audio">("text");

  useEffect(() => {
    if (!isAdmin || !session?.user?.id) return;
    let cancel = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [pub, drf] = await Promise.all([
          fetchNews({ status: "published", limit: 50 }),
          fetchNews({ status: "draft", limit: 50, authorId: session.user.id }),
        ]);
        if (!cancel) {
          setPublished(pub);
          setDrafts(drf);
        }
      } catch (err) {
        if (!cancel) {
          setError(err instanceof Error ? err.message : "Erro ao carregar dados");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    load();
    return () => {
      cancel = true;
    };
  }, [isAdmin, session?.user?.id]);

  const handleCreateNews = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating) return;

    const title = createTitle.trim();
    const description = createDescription.trim();
    const content = createContent.trim();
    const coverImageUrl = createCoverImageUrl.trim();

    if (title.length < 4) {
      setCreateError("O título precisa ter pelo menos 4 caracteres.");
      return;
    }
    if (description.length < 8) {
      setCreateError("A descrição precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (content.length < 16) {
      setCreateError("O conteúdo precisa ter pelo menos 16 caracteres.");
      return;
    }
    if (coverImageUrl && !isValidHttpUrl(coverImageUrl)) {
      setCreateError("A URL da capa precisa ser uma URL válida (http:// ou https://).");
      return;
    }

    let featuredUntil: string | undefined;
    if (createIsFeatured && createFeaturedUntil.trim()) {
      const date = new Date(createFeaturedUntil);
      if (Number.isNaN(date.getTime())) {
        setCreateError("A data de destaque é inválida.");
        return;
      }
      featuredUntil = date.toISOString();
    }

    setCreating(true);
    setCreateError(null);

    try {
      const news = await createNews({
        title,
        description,
        content,
        coverImageUrl: coverImageUrl || undefined,
        tags: (() => {
          const tags = parseTags(createTags);
          return tags.length ? tags : undefined;
        })(),
        status: createStatus,
        isFeatured: createIsFeatured || undefined,
        featuredUntil: createIsFeatured ? featuredUntil : undefined,
      });

      addToast({
        title: "Notícia criada com sucesso",
        description: "Redirecionando para a edição...",
        color: "success",
      });
      router.push(`/edit/${news.slug}`);
    } catch (err) {
      const message = parseCreateErrorMessage(err);
      setCreateError(message);
      addToast({
        title: "Erro ao criar notícia",
        description: message,
        color: "danger",
      });
    } finally {
      setCreating(false);
    }
  };

  const publishedCount = published.length;
  const draftCount = drafts.length;

  const publishedList = useMemo(() => published.slice(0, 8), [published]);
  const draftList = useMemo(() => drafts.slice(0, 8), [drafts]);

  if (isPending) {
    return (
      <div className="w-full h-full px-4 sm:px-8 py-6 text-neutral-800">
        <div className="max-w-6xl mx-auto space-y-3">
          <div className="h-6 w-40 rounded bg-neutral-200 animate-pulse" />
          <div className="h-4 w-64 rounded bg-neutral-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!session?.user) return notFound();
  if (!isAdmin) return notFound();

  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto space-y-6 pb-16">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-orange-500 font-semibold">
              Painel • Admin
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Visão geral dos conteúdos</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Publicados e rascunhos carregados diretamente da API.
            </p>
          </div>
          <button
            type="button"
            onClick={() => auth.signOut?.().catch(() => { })}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 shadow-sm"
          >
            Sair
          </button>
        </header>

        <section className="rounded-2xl border border-neutral-200 bg-white/95 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Perfil</p>
              <h2 className="text-lg font-semibold text-neutral-900">Editar informações</h2>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!userId) return;
                setSavingProfile(true);
                await auth.updateUser(
                  {
                    name: profileName.trim() || undefined,
                    image: profileImage.trim() || null,
                  },
                  {
                    onSuccess: () => {
                      addToast({ title: "Perfil atualizado", color: "success" });
                    },
                    onError: (err) => {
                      const message = parseUnknownErrorMessage(err, "Falha desconhecida");
                      addToast({
                        title: "Erro ao salvar perfil",
                        description: message,
                        color: "danger",
                      });
                    },
                    onSettled: () => {
                      setSavingProfile(false);
                    },
                  },
                );
              }}
              disabled={savingProfile || !userId}
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white px-4 py-2 text-sm font-semibold hover:bg-neutral-800 transition disabled:opacity-60"
            >
              {savingProfile ? "Salvando..." : "Salvar"}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-neutral-800">
              Nome
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Seu nome"
              />
            </label>
            <label className="block text-sm font-medium text-neutral-800">
              URL da foto (opcional)
              <input
                value={profileImage ?? ""}
                onChange={(e) => setProfileImage(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="https://..."
              />
            </label>
          </div>
        </section>

        <Tabs aria-label="Gerenciar conteúdos" variant="underlined" color="warning" fullWidth>
          <Tab key="view" title="Conteúdo">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
                {error}
              </div>
            ) : null}

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-neutral-700">Publicados</p>
                <p className="mt-2 text-3xl font-bold text-neutral-900">{publishedCount}</p>
                <p className="text-xs text-neutral-500 mt-1">Notícias ativas no site</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-neutral-700">Rascunhos</p>
                <p className="mt-2 text-3xl font-bold text-neutral-900">{draftCount}</p>
                <p className="text-xs text-neutral-500 mt-1">Notícias em edição</p>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm h-[420px] flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-neutral-900">Publicados recentes</h2>
                  <span className="text-xs text-neutral-500">{publishedCount} no total</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {loading ? (
                    <div className="space-y-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-10 rounded bg-neutral-100 animate-pulse" />
                      ))}
                    </div>
                  ) : publishedList.length ? (
                    <ul className="space-y-2">
                      {publishedList.map((newsItem) => (
                        <li key={newsItem.id} className="border border-neutral-100 rounded-lg overflow-hidden">
                          <Link href={`/news/${newsItem.slug}`} className="block group">
                            <div className="w-full bg-neutral-100">
                              {newsItem.coverImageUrl ? (
                                <Image
                                  src={newsItem.coverImageUrl}
                                  alt={newsItem.title}
                                  width={640}
                                  height={360}
                                  className="w-full object-cover"
                                  style={{ aspectRatio: "16 / 9" }}
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full bg-neutral-100" style={{ aspectRatio: "16 / 9" }} />
                              )}
                            </div>
                            <div className="px-3 py-2 flex items-start gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-neutral-900 line-clamp-1 group-hover:text-orange-600 transition-colors">
                                  {newsItem.title}
                                </p>
                                <p className="text-xs text-neutral-500">{formatDate(newsItem.createdAt)}</p>
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-neutral-500">Nenhuma notícia publicada ainda.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm h-[420px] flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-neutral-900">Rascunhos</h2>
                  <span className="text-xs text-neutral-500">{draftCount} no total</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {loading ? (
                    <div className="space-y-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-10 rounded bg-neutral-100 animate-pulse" />
                      ))}
                    </div>
                  ) : draftList.length ? (
                    <ul className="space-y-2">
                      {draftList.map((newsItem) => (
                        <li key={newsItem.id} className="border border-neutral-100 rounded-lg overflow-hidden">
                          <Link href={`/edit/${newsItem.slug}`} className="block group">
                            <div className="w-full bg-neutral-100">
                              {newsItem.coverImageUrl ? (
                                <Image
                                  src={newsItem.coverImageUrl}
                                  alt={newsItem.title}
                                  width={640}
                                  height={360}
                                  className="w-full object-cover"
                                  style={{ aspectRatio: "16 / 9" }}
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full bg-neutral-100" style={{ aspectRatio: "16 / 9" }} />
                              )}
                            </div>
                            <div className="px-3 py-2 flex items-start gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-neutral-900 line-clamp-1 group-hover:text-orange-600 transition-colors">
                                  {newsItem.title}
                                </p>
                                <p className="text-xs text-neutral-500">Atualizado {formatDate(newsItem.updatedAt)}</p>
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-neutral-500">Nenhum rascunho criado ainda.</p>
                  )}
                </div>
              </div>
            </section>
          </Tab>


          <Tab key="create" title="Criar">
            <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-4 mt-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Criar notícia</p>
                <h2 className="text-lg font-semibold text-neutral-900">Novo conteúdo</h2>
                <p className="text-sm text-neutral-500 mt-1">Preencha os dados e publique agora ou salve como rascunho.</p>
              </div>

              {createError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
                  {createError}
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={handleCreateNews}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block text-sm font-medium text-neutral-800">
                    Título *
                    <input
                      value={createTitle}
                      onChange={(e) => setCreateTitle(e.target.value)}
                      minLength={4}
                      required
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Título da notícia"
                    />
                  </label>

                  <label className="block text-sm font-medium text-neutral-800">
                    Status
                    <select
                      value={createStatus}
                      onChange={(e) => setCreateStatus(e.target.value as NewsStatus)}
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="draft">Rascunho</option>
                      <option value="published">Publicado</option>
                    </select>
                  </label>
                </div>

                <label className="block text-sm font-medium text-neutral-800">
                  Descrição *
                  <textarea
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    minLength={8}
                    required
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Resumo da notícia"
                  />
                </label>

                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-neutral-800">Conteúdo *</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Use as abas para alternar entre edição de texto e upload de áudio.
                    </p>
                  </div>

                  <Tabs
                    aria-label="Ferramentas de conteúdo na criação"
                    selectedKey={createContentToolTab}
                    onSelectionChange={(key) => setCreateContentToolTab(key as "text" | "audio")}
                    color="warning"
                    variant="underlined"
                    classNames={{
                      tab: "text-sm font-semibold",
                    }}
                  >
                    <Tab key="text" title="Texto">
                      <textarea
                        value={createContent}
                        onChange={(e) => setCreateContent(e.target.value)}
                        minLength={16}
                        required
                        rows={10}
                        className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Conteúdo em Markdown"
                      />
                    </Tab>
                    <Tab key="audio" title="Audio Desk">
                      <AudioUploadPanel
                        onTokenReady={(token) => {
                          setCreateContent((current) => appendMarkdownToken(current, token));
                        }}
                        disabled={creating}
                      />
                    </Tab>
                  </Tabs>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block text-sm font-medium text-neutral-800">
                    URL da capa (opcional)
                    <input
                      type="url"
                      value={createCoverImageUrl}
                      onChange={(e) => setCreateCoverImageUrl(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="https://..."
                    />
                  </label>

                  <label className="block text-sm font-medium text-neutral-800">
                    Tags (opcional)
                    <input
                      value={createTags}
                      onChange={(e) => setCreateTags(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="tecnologia, brasil, política"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-800">
                    <input
                      type="checkbox"
                      checked={createIsFeatured}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCreateIsFeatured(checked);
                        if (!checked) setCreateFeaturedUntil("");
                      }}
                      className="h-4 w-4 rounded border-neutral-300 text-orange-500 focus:ring-orange-500"
                    />
                    Marcar como destaque
                  </label>

                  <label className="block text-sm font-medium text-neutral-800">
                    Destacar até (opcional)
                    <input
                      type="datetime-local"
                      value={createFeaturedUntil}
                      onChange={(e) => setCreateFeaturedUntil(e.target.value)}
                      disabled={!createIsFeatured}
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
                    />
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-2 text-sm font-semibold hover:bg-neutral-800 transition disabled:opacity-60"
                  >
                    {creating ? "Criando..." : "Criar notícia"}
                  </button>
                </div>
              </form>
            </section>
          </Tab>


        </Tabs>
      </div>
    </main>
  );
}
