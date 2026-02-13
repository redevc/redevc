"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, addToast } from "@heroui/react";
import { FiMoreHorizontal, FiUser, FiX } from "react-icons/fi";

import { auth } from "@/lib/auth";
import { UserStatus } from "@/components/UI/user/UserStatus";
import { fetchComments, createComment, deleteComment, type Comment } from "@/lib/api/comments";

type Props = {
  slug: string;
  newsId: string; // Obrigatório para usar a API
};

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const pickAvatarColor = (name: string) => {
  const palette = ["primary", "secondary", "success", "warning", "danger"] as const;
  const code = name.charCodeAt(0) || 0;
  return palette[code % palette.length];
};

export function Comments({ slug, newsId }: Props) {
  const { data: session } = auth.useSession();
  const user = session?.user as
    | { id?: string | null; name?: string | null; email?: string | null; image?: string | null }
    | undefined;
  const isLogged = Boolean(user);

  const [comments, setComments] = useState<Comment[]>([]);
  const [form, setForm] = useState({ message: "" });
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; threadId: string } | null>(
    null,
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Carregar comentários da API
  useEffect(() => {
    const loadComments = async () => {
      if (!newsId) return;

      setLoading(true);
      try {
        const response = await fetchComments({ newsId, limit: 500 });
        const list = response.data;

        // Normalizar threadId (caso necessário)
        const baseMap = new Map(list.map((c) => [c.id, c] as const));
        const resolveThread = (c: Comment): string => {
          const visited = new Set<string>();
          let current: Comment | undefined = c;
          while (
            current?.replyTo &&
            baseMap.has(current.replyTo) &&
            !visited.has(current.replyTo)
          ) {
            visited.add(current.replyTo);
            current = baseMap.get(current.replyTo);
          }
          return current?.id ?? c.id;
        };

        const normalized = list.map((c) => ({
          ...c,
          threadId: c.threadId ?? resolveThread(c),
        }));
        setComments(normalized);
      } catch (err) {
        console.error("Erro ao carregar comentários:", err);
        addToast({
          title: "Erro",
          description: "Não foi possível carregar os comentários",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [newsId]);

  // focar textarea ao responder
  const focusTextarea = () => requestAnimationFrame(() => textareaRef.current?.focus());

  const commentById = useMemo(() => {
    const map = new Map<string, Comment>();
    comments.forEach((c) => map.set(c.id, c));
    return map;
  }, [comments]);

  const topLevelComments = useMemo(
    () =>
      comments
        .filter((c) => c.threadId === c.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [comments],
  );

  const repliesByThread = useMemo(() => {
    const map = new Map<string, Comment[]>();
    comments
      .filter((c) => c.threadId !== c.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach((c) => {
        const list = map.get(c.threadId) ?? [];
        list.push(c);
        map.set(c.threadId, list);
      });
    return map;
  }, [comments]);

  const handleCommentSubmit = async () => {
    if (!isLogged) {
      addToast({
        title: "Login obrigatório",
        description: "Entre para comentar.",
        color: "warning",
      });
      return;
    }

    const commentMessage = form.message.trim();

    if (!commentMessage || !newsId) {
      addToast({
        title: "Campos obrigatórios",
        description: "Informe comentário.",
        color: "warning",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await createComment({
        newsId,
        replyTo: replyTo?.id ?? null,
        message: commentMessage,
      });

      // Adicionar o novo comentário à lista local
      const saved: Comment = response.data;
      const next = [...comments, saved].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setComments(next);

      setForm((prev) => ({ ...prev, message: "" }));
      setReplyTo(null);
      addToast({
        title: "Comentário salvo",
        description: "Obrigado por comentar!",
        color: "success",
      });
    } catch (err) {
      console.error("Erro ao criar comentário:", err);
      addToast({
        title: "Erro",
        description: "Não foi possível salvar o comentário",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteThread = async (target: Comment) => {
    setLoading(true);
    try {
      await deleteComment(target.id);

      // Remover da lista local (o backend já deletou as respostas)
      const toDelete = new Set<string>();
      const dfs = (id: string) => {
        toDelete.add(id);
        comments.forEach((c) => {
          if (c.replyTo === id) dfs(c.id);
        });
      };
      dfs(target.id);

      const remaining = comments.filter((c) => !toDelete.has(c.id));
      setComments(remaining);

      if (replyTo && toDelete.has(replyTo.id)) setReplyTo(null);

      addToast({
        title: "Sucesso",
        description: "Comentário deletado",
        color: "success",
      });
    } catch (err) {
      console.error("Erro ao deletar comentário:", err);
      addToast({
        title: "Erro",
        description: "Não foi possível deletar",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
    setMenuOpenId(null);
  };

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const canDeleteComment = useCallback(
    (c: Comment) =>
      isLogged &&
      ((c.userId && user?.id === c.userId) || (user?.email && c.email && user.email === c.email)),
    [isLogged, user],
  );

  const renderComments = () => {
    return topLevelComments.map((c) => {
      const replies = repliesByThread.get(c.id) ?? [];
      const expanded = expandedIds.has(c.id);

      return (
        <div key={c.id} className="rounded-lg border border-neutral-200 bg-white/80 p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <Avatar
              src={c.userImage ?? undefined}
              name={(c.name || "??").slice(0, 2).toUpperCase()}
              icon={!c.userImage ? <FiUser /> : undefined}
              color={pickAvatarColor(c.name || c.email || "Coment")}
              size="sm"
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 text-xs text-neutral-500 mb-1">
                <div className="space-y-0.5">
                  <span className="font-semibold text-neutral-800">{c.name}</span>
                </div>
                <div className="relative flex flex-wrap items-center gap-2">
                  <span>
                    {new Date(c.createdAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo({ id: c.id, name: c.name, threadId: c.threadId });
                      focusTextarea();
                    }}
                    className="rounded px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-200"
                  >
                    Responder
                  </button>
                  {canDeleteComment(c) ? (
                    <button
                      type="button"
                      onClick={() => setMenuOpenId((prev) => (prev === c.id ? null : c.id))}
                      className="p-1 rounded hover:bg-neutral-200 text-neutral-500"
                      title="Opções"
                    >
                      <FiMoreHorizontal />
                    </button>
                  ) : null}
                  {menuOpenId === c.id ? (
                    <div className="absolute right-0 top-6 z-10 w-36 rounded-md border border-neutral-200 bg-white shadow-lg text-xs text-neutral-700">
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-neutral-100"
                        onClick={() => {
                          setReplyTo({ id: c.id, name: c.name, threadId: c.threadId });
                          setMenuOpenId(null);
                          focusTextarea();
                        }}
                      >
                        Responder
                      </button>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-red-600 hover:bg-neutral-100"
                        onClick={() => {
                          const ok = confirm("Deletar este comentário e suas respostas?");
                          if (ok) deleteThread(c);
                          setMenuOpenId(null);
                        }}
                      >
                        Deletar
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-neutral-800 whitespace-pre-wrap wrap-break-words">
                {c.message}
              </p>

              {replies.length ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(c.id)}
                    className="text-sm font-semibold text-orange-600 hover:underline"
                  >
                    {expanded ? "Ocultar respostas" : `Ver ${replies.length} resposta(s)`}
                  </button>
                  {expanded ? (
                    <div className="mt-3 space-y-3 border-l border-neutral-200 pl-3 sm:pl-4">
                      {replies.map((child) => {
                        const repliedName = child.replyTo
                          ? commentById.get(child.replyTo)?.name
                          : undefined;
                        const childCanDelete = canDeleteComment(child);
                        return (
                          <div
                            key={child.id}
                            className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
                          >
                            <div className="flex items-start gap-3">
                              <Avatar
                                src={child.userImage ?? undefined}
                                name={(child.name || "??").slice(0, 2).toUpperCase()}
                                icon={!child.userImage ? <FiUser /> : undefined}
                                color={pickAvatarColor(child.name || child.email || "Coment")}
                                size="sm"
                                className="shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 text-xs text-neutral-500 mb-1">
                                  <div className="space-y-0.5">
                                    <span className="font-semibold text-neutral-800">
                                      {child.name}
                                    </span>
                                    {repliedName ? (
                                      <span className="text-[11px] text-neutral-500">
                                        {" "}
                                        Respondendo a @{repliedName}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="relative flex flex-wrap items-center gap-2">
                                    <span>
                                      {new Date(child.createdAt).toLocaleString("pt-BR", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                      })}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyTo({
                                          id: child.id,
                                          name: child.name,
                                          threadId: child.threadId,
                                        });
                                        focusTextarea();
                                      }}
                                      className="rounded px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-200"
                                    >
                                      Responder
                                    </button>
                                    {childCanDelete ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMenuOpenId((prev) =>
                                            prev === child.id ? null : child.id,
                                          )
                                        }
                                        className="p-1 rounded hover:bg-neutral-200 text-neutral-500"
                                        title="Opções"
                                      >
                                        <FiMoreHorizontal />
                                      </button>
                                    ) : null}
                                    {menuOpenId === child.id ? (
                                      <div className="absolute right-0 top-6 z-10 w-36 rounded-md border border-neutral-200 bg-white shadow-lg text-xs text-neutral-700">
                                        <button
                                          type="button"
                                          className="w-full px-3 py-2 text-left hover:bg-neutral-100"
                                          onClick={() => {
                                            setReplyTo({
                                              id: child.id,
                                              name: child.name,
                                              threadId: child.threadId,
                                            });
                                            setMenuOpenId(null);
                                            focusTextarea();
                                          }}
                                        >
                                          Responder
                                        </button>
                                        <button
                                          type="button"
                                          className="w-full px-3 py-2 text-left text-red-600 hover:bg-neutral-100"
                                          onClick={() => {
                                            const ok = confirm(
                                              "Deletar este comentário e suas respostas?",
                                            );
                                            if (ok) deleteThread(child);
                                            setMenuOpenId(null);
                                          }}
                                        >
                                          Deletar
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                                <p className="text-sm text-neutral-800 whitespace-pre-wrap wrap-break-words">
                                  {repliedName ? (
                                    <span className="font-semibold text-neutral-900 mr-1">
                                      @{repliedName}
                                    </span>
                                  ) : null}
                                  {child.message}
                                </p>
                                {child.site || child.email ? (
                                  <div className="mt-2 text-xs text-neutral-500 flex gap-3">
                                    {child.email ? <span>{child.email}</span> : null}
                                    {child.site ? (
                                      <a
                                        href={child.site}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-orange-600 hover:underline break-all"
                                      >
                                        {child.site}
                                      </a>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <section className="pt-6">
      <div className="rounded-xl border border-neutral-200 bg-white/80 shadow-sm p-3 sm:p-4 space-y-4">
        {loading && comments.length === 0 ? (
          <p className="text-sm text-neutral-500">Carregando comentários...</p>
        ) : comments.length ? (
          <div className="space-y-3">
            <h3 className="text-md font-semibold text-neutral-900">
              Comentários ({comments.length})
            </h3>
            <div className="space-y-3">{renderComments()}</div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Seja o primeiro a comentar.</p>
        )}

        <div className="border-t border-neutral-200 pt-4 space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">Deixe um comentário</h2>
          {!isLogged ? (
            <div className="rounded-lg border border-neutral-200 bg-white/80 px-3 py-4 text-sm text-neutral-700 flex items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <FiUser className="text-neutral-500" />
                <span>Entre para comentar.</span>
              </div>
              <UserStatus />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 text-sm text-neutral-700">
                <Avatar
                  src={user?.image ?? undefined}
                  name={(user?.name ?? user?.email ?? "Você").slice(0, 2).toUpperCase()}
                  color={pickAvatarColor(user?.name ?? user?.email ?? "Você")}
                  size="sm"
                  className="shrink-0"
                />
                <div className="leading-tight">
                  Comentando como{" "}
                  <span className="font-semibold text-neutral-900">
                    {user?.name ?? user?.email ?? "Você"}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-neutral-700">
                  Comentário:
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                    rows={5}
                    ref={textareaRef}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    placeholder="Escreva seu comentário..."
                  />
                </label>
                {replyTo ? (
                  <div className="flex items-center gap-2 text-xs text-neutral-600 bg-neutral-100 border border-neutral-200 rounded-md px-2 py-1 w-fit">
                    {" "}
                    Respondendo a{" "}
                    <span className="font-semibold text-neutral-800">{replyTo.name}</span>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="p-1 rounded hover:bg-neutral-200"
                      aria-label="Cancelar resposta"
                    >
                      <FiX />
                    </button>
                  </div>
                ) : null}
                {/* <div className="rounded-lg border border-neutral-200 bg-white/70 px-3 py-2 text-sm text-neutral-700">
                  Publicando como <span className="font-semibold text-neutral-900">{user?.name ?? user?.email ?? "Você"}</span>
                </div> */}
                <button
                  type="button"
                  onClick={handleCommentSubmit}
                  disabled={loading}
                  className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-semibold hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Postando..." : "Postar comentário"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
