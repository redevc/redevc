"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addToast } from "@heroui/react";

import {
  buildAudioToken,
  completeAudioUpload,
  createAudioUploadSession,
  getAudioAssetStatus,
  uploadAudioChunk,
} from "@/lib/api/audio";

type Props = {
  onTokenReady: (token: string) => void;
  disabled?: boolean;
  className?: string;
};

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 900;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

export function AudioUploadPanel({ onTokenReady, disabled = false, className }: Props) {
  const mountedRef = useRef(true);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const canUpload = useMemo(() => !disabled && !running && !!file, [disabled, file, running]);
  const badgeText = running ? "PROCESSANDO" : generatedToken ? "PRONTO" : "DESK";

  const handleUpload = async () => {
    if (!file || running || disabled) return;

    setRunning(true);
    setProgress(0);
    setError(null);
    setGeneratedToken(null);

    try {
      setStatusLabel("Criando sessão de upload...");
      const session = await createAudioUploadSession({
        fileName: file.name,
        mimeType: file.type || undefined,
        sizeBytes: file.size,
      });

      if (file.size > session.maxBytes) {
        throw new Error(`Arquivo excede o limite (${formatBytes(session.maxBytes)}).`);
      }

      setStatusLabel("Enviando partes do arquivo...");

      for (let index = 0; index < session.totalChunks; index += 1) {
        const start = index * session.chunkSize;
        const end = Math.min(start + session.chunkSize, file.size);
        const chunk = file.slice(start, end);

        await uploadAudioChunk(session.uploadId, index, chunk);

        if (!mountedRef.current) return;

        const ratio = file.size === 0 ? 0 : end / file.size;
        setProgress(Math.min(100, Math.round(ratio * 100)));
      }

      setStatusLabel("Finalizando upload e enfileirando conversão...");
      const completion = await completeAudioUpload(session.uploadId);
      let assetStatus = completion.status;
      const assetId = completion.assetId;

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        if (assetStatus === "ready") break;
        if (assetStatus === "failed") {
          throw new Error("A conversão do áudio falhou no servidor.");
        }

        setStatusLabel(assetStatus === "processing" ? "Convertendo para MP3..." : "Aguardando conversão...");
        await sleep(POLL_INTERVAL_MS);

        const status = await getAudioAssetStatus(assetId);
        assetStatus = status.status;

        if (status.status === "failed") {
          throw new Error(status.errorMessage || "A conversão do áudio falhou no servidor.");
        }

        if (status.status === "ready") {
          const token = buildAudioToken(assetId, title);
          onTokenReady(token);
          setGeneratedToken(token);
          setStatusLabel("Áudio pronto. Token @audio inserido no conteúdo.");
          setProgress(100);
          addToast({
            title: "Áudio enviado",
            description: "Token @audio inserido no conteúdo da notícia.",
            color: "success",
          });
          return;
        }
      }

      throw new Error("Tempo limite excedido ao aguardar conversão do áudio.");
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Falha ao enviar áudio.";
      if (mountedRef.current) {
        setError(message);
        setStatusLabel(null);
      }
      addToast({
        title: "Erro no upload de áudio",
        description: message,
        color: "danger",
      });
    } finally {
      if (mountedRef.current) {
        setRunning(false);
      }
    }
  };

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_18px_40px_-26px_rgba(0,0,0,0.45)] ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-red-500/40 bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-red-400">Audio Desk</p>
          <h3 className="text-sm font-semibold text-white">Upload para matéria</h3>
        </div>
        <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-200">
          {badgeText}
        </span>
      </div>

      <div className="space-y-4 bg-gradient-to-b from-white to-neutral-50 p-4">
        <p className="text-xs text-neutral-600">
          Faça upload e o sistema insere automaticamente o token{" "}
          <code className="px-1 rounded bg-yellow-300/70 text-foreground font-mono">@audio</code>{" "}
          no conteúdo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-neutral-800">
            Arquivo de áudio
            <input
              type="file"
              accept="audio/*,.mp3,.ogg,.m4a,.wav,.flac,.aac"
              disabled={disabled || running}
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                setGeneratedToken(null);
                setError(null);
              }}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/70 disabled:opacity-60"
            />
          </label>

          <label className="block text-sm font-medium text-neutral-800">
            Título opcional no token
            <input
              type="text"
              value={title}
              disabled={disabled || running}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/70 disabled:opacity-60"
              placeholder="Ex: Entrevista completa"
            />
          </label>
        </div>

        {file ? (
          <p className="text-xs rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-neutral-600">
            Selecionado: <span className="font-semibold text-neutral-800">{file.name}</span> ({formatBytes(file.size)})
          </p>
        ) : null}

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={!canUpload}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 transition disabled:opacity-60"
          >
            {running ? "Enviando..." : "Enviar áudio"}
          </button>

          {running || statusLabel ? (
            <div className="space-y-1">
              {statusLabel ? <p className="text-xs text-neutral-700 font-medium">{statusLabel}</p> : null}
              <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-red-700 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500">{progress}%</p>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>
        ) : null}

        {generatedToken ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-500 mb-1 uppercase tracking-[0.12em] font-semibold">Token gerado</p>
            <code className="block text-xs md:text-sm text-neutral-900 break-all">{generatedToken}</code>
          </div>
        ) : null}
      </div>
    </section>
  );
}
