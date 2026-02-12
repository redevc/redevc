"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Spinner, Tooltip } from "@heroui/react";
import { Save, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { useEditNews } from "@/lib/edit-news-context";

function formatRelative(ms: number) {
  if (Number.isNaN(ms)) return "";
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return "há poucos segundos";
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return "há 1 minuto";
  if (minutes < 60) return `há ${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "há 1 hora";
  if (hours < 24) return `há ${hours} horas`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}

export function SaveBubble() {
  const edit = useEditNews();
  const [mounted, setMounted] = useState(false);
  const [minimized, setMinimized] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!edit) return;
    const handler = (event: KeyboardEvent) => {
      const isSaveCombo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
      if (!isSaveCombo) return;
      event.preventDefault();
      void edit.save();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [edit]);

  const lastSavedText = useMemo(() => {
    if (!edit?.lastSavedAt) return "Nunca salvo";
    return formatRelative(Date.now() - edit.lastSavedAt);
  }, [edit?.lastSavedAt]);

  const status = useMemo(() => {
    const pendingCount = edit?.dirtyFields?.length ?? 0;
    if (edit?.saving) {
      return { label: "Salvando...", tone: "info" as const };
    }
    if (edit?.error) {
      return { label: "Erro ao salvar", tone: "error" as const };
    }
    if (edit?.dirty) {
      return { label: `${pendingCount || "1+"} pendente(s)`, tone: "warn" as const };
    }
    return { label: "Tudo salvo", tone: "success" as const };
  }, [edit?.dirty, edit?.dirtyFields, edit?.error, edit?.saving]);

  if (!edit || !mounted) return null;

  const bubble = (
    <div className="relative rounded-2xl border border-orange-200 bg-white shadow-[0_18px_80px_-24px_rgba(0,0,0,0.35)] flex items-start gap-3 px-4 py-3 max-w-sm pointer-events-auto">
      <button
        type="button"
        onClick={() => setMinimized(true)}
        className="absolute right-2 top-2 text-neutral-300 hover:text-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 rounded-full p-1"
        aria-label="Minimizar painel de salvamento"
      >
        ×
      </button>
      <div className="flex items-center pt-0.5">
        <span className="h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse" aria-hidden />
      </div>
      <div className="flex-1 space-y-1 pr-6">
        <p className="text-sm font-semibold text-neutral-900">Edição da notícia</p>
        <p className="text-xs text-neutral-600" aria-live="polite">
          {edit.dirty
            ? `Você tem ${edit.dirtyFields?.length ?? 0} alteração(ões) pendente(s).`
            : "Nenhuma alteração pendente agora."}
          {lastSavedText ? ` • Última: ${lastSavedText}` : null}
        </p>
        <div className="flex items-center gap-2 text-xs">
          {status.tone === "success" ? (
            <CheckCircle size={12} className="text-emerald-600" aria-hidden />
          ) : status.tone === "error" ? (
            <AlertTriangle size={12} className="text-red-600" aria-hidden />
          ) : (
            <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" aria-hidden />
          )}
          <span
            className={
              status.tone === "error"
                ? "text-red-700"
                : status.tone === "warn"
                  ? "text-amber-700"
                  : "text-neutral-600"
            }
          >
            {status.label}
          </span>
        </div>
        {edit.error ? <p className="text-xs text-red-600">{edit.error}</p> : null}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => void edit.save()}
            disabled={edit.saving || !edit.dirty || edit.loading}
            className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-60"
          >
            {edit.saving ? <Spinner color="default" size="sm" className="text-white" /> : <Save size={14} />}
            {edit.dirty ? "Salvar alterações" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={edit.reset}
            disabled={!edit.dirty || edit.loading}
            className="text-xs font-semibold text-neutral-600 hover:text-neutral-800 disabled:opacity-50"
          >
            Descartar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed right-4 sm:right-6 bottom-4 sm:bottom-6 z-99 pointer-events-none">
      <div className="flex items-end gap-2 pointer-events-auto">
        {minimized ? (
          <Tooltip
            content="Abrir painel de salvamento"
            placement="left"
            delay={80}
          >
            <button
              type="button"
              onClick={() => setMinimized(false)}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-3 py-2 text-xs font-semibold text-white shadow-lg hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
              aria-label="Abrir painel de salvamento"
            >
              {edit.saving ? (
                <Spinner size="sm" color="default" className="text-white" />
              ) : edit.error ? (
                <AlertTriangle size={14} />
              ) : edit.dirty ? (
                <Save size={14} />
              ) : (
                <CheckCircle size={14} />
              )}
              <span className="hidden sm:inline">
                {edit.saving
                  ? "Salvando"
                  : edit.error
                    ? "Erro"
                    : edit.dirty
                      ? status.label
                      : "Salvo"}
              </span>
              <ChevronUp size={14} />
            </button>
          </Tooltip>
        ) : null}

        <AnimatePresence mode="popLayout">
          {!minimized ? (
            <motion.div
              key="bubble"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              {bubble}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}
