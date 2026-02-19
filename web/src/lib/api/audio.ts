const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export type AudioAssetStatus = "queued" | "processing" | "ready" | "failed";

export type CreateAudioUploadSessionInput = {
  fileName: string;
  mimeType?: string;
  sizeBytes: number;
};

export type CreateAudioUploadSessionResponse = {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  maxBytes: number;
};

export type CompleteAudioUploadResponse = {
  assetId: string;
  status: AudioAssetStatus;
};

export type AudioAssetStatusResponse = {
  id: string;
  status: AudioAssetStatus;
  errorMessage?: string;
  playbackUrl?: string;
};

const ensureApiUrl = () => {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL não configurado");
  }
};

const parseError = async (res: Response) => {
  const txt = await res.text();
  if (!txt) return `Request failed ${res.status}`;

  try {
    const data = JSON.parse(txt) as { message?: string };
    if (data?.message) return `Request failed ${res.status}: ${data.message}`;
  } catch {
    return `Request failed ${res.status}: ${txt}`;
  }

  return `Request failed ${res.status}: ${txt}`;
};

export async function createAudioUploadSession(
  input: CreateAudioUploadSessionInput,
): Promise<CreateAudioUploadSessionResponse> {
  ensureApiUrl();

  const res = await fetch(`${API_URL}/media/audio/uploads`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as CreateAudioUploadSessionResponse;
}

export async function uploadAudioChunk(
  uploadId: string,
  index: number,
  chunk: Blob,
): Promise<void> {
  ensureApiUrl();

  const res = await fetch(`${API_URL}/media/audio/uploads/${encodeURIComponent(uploadId)}/chunks/${index}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: chunk,
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export async function completeAudioUpload(uploadId: string): Promise<CompleteAudioUploadResponse> {
  ensureApiUrl();

  const res = await fetch(`${API_URL}/media/audio/uploads/${encodeURIComponent(uploadId)}/complete`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as CompleteAudioUploadResponse;
}

export async function getAudioAssetStatus(assetId: string): Promise<AudioAssetStatusResponse> {
  ensureApiUrl();

  const res = await fetch(`${API_URL}/media/audio/assets/${encodeURIComponent(assetId)}/status`, {
    cache: "no-store",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as AudioAssetStatusResponse;
}

export function buildAudioToken(target: string, title?: string) {
  const normalizedTarget = target.trim();
  const normalizedTitle = title?.trim();

  if (!normalizedTarget) {
    throw new Error("target inválido para @audio");
  }

  return normalizedTitle
    ? `@audio ${normalizedTarget} | ${normalizedTitle}`
    : `@audio ${normalizedTarget}`;
}
