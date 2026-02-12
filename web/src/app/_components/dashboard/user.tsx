"use client";

import Image from "next/image";
import { notFound } from "next/navigation";
import { useMemo, useState } from "react";
import { addToast } from "@heroui/react";

import { auth } from "@/lib/auth";
import { isPublisherRole } from "@/utils/roles";

export function UserDashboardClient() {
  const { data: session, isPending } = auth.useSession();
  const user = session?.user;
  const userId = user?.id as string | undefined;
  const [name, setName] = useState(user?.name ?? "");
  const [image, setImage] = useState(user?.image ?? "");
  const [saving, setSaving] = useState(false);

  if (isPending) {
    return (
      <div className="w-full h-full min-h-screen px-4 sm:px-8 py-10 text-neutral-800 bg-gradient-to-b from-white via-neutral-50 to-white">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="h-6 w-40 rounded bg-neutral-200 animate-pulse" />
          <div className="h-4 w-64 rounded bg-neutral-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) return notFound();
  if (isPublisherRole(user.role)) return notFound();

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-white via-neutral-50 to-white">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="rounded-2xl border border-neutral-200 bg-white/95 backdrop-blur-sm p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 w-full">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name ?? "Usuário"}
                width={88}
                height={88}
                className="h-20 w-20 rounded-full object-cover border border-neutral-200 shadow-sm"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-2xl font-bold border border-neutral-200 shadow-sm">
                {(user.name ?? user.email ?? "??").slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <p className="text-xl font-semibold text-neutral-900 truncate">{user.name ?? "Usuário"}</p>
              <p className="text-sm text-neutral-600 truncate">{user.email ?? "Email não informado"}</p>
              <p className="text-xs text-neutral-500 mt-1">
                Perfil: <span className="font-semibold text-neutral-800">{user.role ?? "autor"}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => auth.signOut?.().catch(() => {})}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 shadow-sm"
            >
              Sair
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-neutral-200 bg-white/95 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Perfil</p>
                <h2 className="text-lg font-semibold text-neutral-900">Editar informações</h2>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!userId) return;
                  setSaving(true);
                  await auth.updateUser(
                    {
                      name: name.trim() || undefined,
                      image: image.trim() || null,
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
                          title: "Erro ao salvar",
                          description: message,
                          color: "danger",
                        });
                      },
                      onSettled: () => {
                        setSaving(false);
                      },
                    },
                  );
                }}
                disabled={saving || !userId}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white px-4 py-2 text-sm font-semibold hover:bg-neutral-800 transition disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-800">
                Nome
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Seu nome"
                />
              </label>
              <label className="block text-sm font-medium text-neutral-800">
                URL da foto (opcional)
                <input
                  value={image ?? ""}
                  onChange={(e) => setImage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="https://..."
                />
              </label>
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm min-h-[180px] flex items-center justify-center text-neutral-500 text-sm">
            Dicas e atalhos para criar/editar notícias (em breve).
          </div>
        </div>
      </section>
    </main>
  );
}
