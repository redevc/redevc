"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { addToast, Tabs, Tab } from "@heroui/react";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { createNews, fetchNews } from "@/lib/api/news";
import type { News } from "@/types/news";
import { isPublisherRole } from "@/utils/roles";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function AdminDashboardClient() {
  const { data: session, isPending } = auth.useSession();
  const [published, setPublished] = useState<News[]>([]);
  const [drafts, setDrafts] = useState<News[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | undefined>();
  const [form, setForm] = useState({
    title: "",
    description: "",
    content: "",
    coverImageUrl: "",
    tagsInput: "",
    status: "draft" as "draft" | "published",
  });

  const user = session?.user;
  const userId = user?.id as string | undefined;
  const isAdmin = isPublisherRole(user?.role);
  const [profileName, setProfileName] = useState(user?.name ?? "");
  const [profileImage, setProfileImage] = useState(user?.image ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

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

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result?.toString();
      if (result) {
        setCoverPreview(result);
        setForm((f) => ({ ...f, coverImageUrl: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.content.trim()) {
      addToast({ title: "Preencha título, descrição e conteúdo", color: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        content: form.content.trim(),
        coverImageUrl: form.coverImageUrl || undefined,
        tags: form.tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        status: form.status,
      };
      await createNews(payload);
      addToast({ title: "Publicação criada", color: "success" });
      setForm({
        title: "",
        description: "",
        content: "",
        coverImageUrl: "",
        tagsInput: "",
        status: "draft",
      });
      setCoverPreview(undefined);
      setLoading(true);
      const [pub, drf] = await Promise.all([
        fetchNews({ status: "published", limit: 50 }),
        fetchNews({ status: "draft", limit: 50, authorId: session?.user?.id }),
      ]);
      setPublished(pub);
      setDrafts(drf);
    } catch (err) {
      addToast({
        title: "Erro ao criar publicação",
        description: err instanceof Error ? err.message : "Falha desconhecida",
        color: "danger",
      });
    } finally {
      setSubmitting(false);
      setLoading(false);
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
            onClick={() => auth.signOut?.().catch(() => {})}
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
                        const message =
                          err instanceof Error
                            ? err.message
                            : (err as any)?.message || (err as any)?.error || "Falha desconhecida";
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
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Nova publicação</p>
                  <h2 className="text-lg font-semibold text-neutral-900">Criar notícia</h2>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span>Status:</span>
                    <select
                      className="border border-neutral-200 rounded px-2 py-1 text-sm bg-white"
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "draft" | "published" }))}
                    >
                      <option value="draft">Rascunho</option>
                      <option value="published">Publicado</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <input
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Título"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                  <textarea
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Descrição curta"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                  <textarea
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Conteúdo"
                    value={form.content}
                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  />
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">Capa</label>
                    {coverPreview ? (
                      <Image
                        src={coverPreview}
                        alt="Pré-visualização"
                        width={640}
                        height={360}
                        className="w-full h-40 object-cover rounded-lg border border-neutral-200"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-40 rounded-lg border border-dashed border-neutral-300 flex items-center justify-center text-sm text-neutral-400">
                        Sem imagem
                      </div>
                    )}
                    <input
                      type="url"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="URL da imagem (opcional)"
                      value={form.coverImageUrl}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, coverImageUrl: e.target.value }));
                        setCoverPreview(e.target.value);
                      }}
                    />
                    <label className="text-sm text-neutral-600">ou envie um arquivo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                      className="text-sm"
                    />
                    <p className="text-xs text-neutral-500">
                      Arquivos são convertidos para base64 e enviados como coverImageUrl (funciona em produção no Next).
                    </p>
                  </div>
                  <input
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Tags separadas por vírgula"
                    value={form.tagsInput}
                    onChange={(e) => setForm((f) => ({ ...f, tagsInput: e.target.value }))}
                  />
                  <button
                    onClick={handleCreate}
                    disabled={submitting}
                    className="w-full rounded-lg bg-neutral-900 text-white py-2 text-sm font-semibold hover:bg-neutral-800 transition disabled:opacity-60"
                  >
                    {submitting ? "Enviando..." : "Publicar"}
                  </button>
                </div>
              </div>
            </section>
          </Tab>
        </Tabs>
      </div>
    </main>
  );
}
