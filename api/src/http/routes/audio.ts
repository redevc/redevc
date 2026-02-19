import { randomUUID } from "crypto";
import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { Elysia } from "elysia";
import { z } from "zod";

import { env } from "../../config/env.js";
import {
  audioAssetsCollection,
  audioGridFsBucket,
  audioGridFsFilesCollection,
  audioUploadSessionsCollection,
  ensureAudioIndexes,
  type AudioAsset,
  type AudioUploadSession,
  type AudioAssetDocument,
  type AudioUploadSessionDocument,
} from "../../database/collections/audio.js";
import { isPublisherRole } from "../../utils/roles.js";
import { betterAuthPlugin } from "../plugins/better-auth.js";
import {
  audioAssetStatusParamsSchema,
  audioAssetStatusResponseSchema,
  audioUploadChunkParamsSchema,
  audioUploadChunkResponseSchema,
  audioUploadCompleteParamsSchema,
  audioUploadCompleteResponseSchema,
  audioUploadCreateResponseSchema,
  audioUploadCreateSchema,
} from "../schemas/audio.js";

await ensureAudioIndexes();

const errorSchema = z.object({ message: z.string() });

const nowIso = () => new Date().toISOString();

const ensureUploadDir = async (uploadId: string) => {
  const chunksDir = path.join(env.AUDIO_UPLOAD_TMP_DIR, uploadId);
  await mkdir(chunksDir, { recursive: true });
  return chunksDir;
};

const chunkPath = (chunksDir: string, index: number) => path.join(chunksDir, `${index}.part`);

const parseRange = (rangeHeader: string | null, totalSize: number) => {
  if (!rangeHeader) {
    return { start: 0, end: totalSize - 1, partial: false };
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  const startRaw = match[1];
  const endRaw = match[2];

  let start = startRaw ? Number(startRaw) : NaN;
  let end = endRaw ? Number(endRaw) : NaN;

  if (Number.isNaN(start) && Number.isNaN(end)) return null;

  if (Number.isNaN(start)) {
    const suffixLength = Number(endRaw);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, totalSize - suffixLength);
    end = totalSize - 1;
  } else if (Number.isNaN(end)) {
    end = totalSize - 1;
  }

  if (start < 0 || end < 0 || start > end || end >= totalSize) return null;

  return { start, end, partial: true };
};

const verifyPublisher = (role?: string | null) => isPublisherRole(role);

const getExpectedChunkSize = (session: AudioUploadSession, index: number) => {
  const isLast = index === session.totalChunks - 1;
  if (!isLast) return session.chunkSize;

  const remaining = session.sizeBytes - session.chunkSize * (session.totalChunks - 1);
  return remaining > 0 ? remaining : session.chunkSize;
};

export const audioRoutes = new Elysia({ prefix: "/media/audio" })
  .use(betterAuthPlugin)
  .post(
    "/uploads",
    async ({ body, user, set }) => {
      if (!verifyPublisher(user.role)) {
        set.status = 403;
        return { message: "only publishers can upload audio" };
      }

      if (body.sizeBytes > env.AUDIO_UPLOAD_MAX_BYTES) {
        set.status = 413;
        return {
          message: `file too large, max allowed is ${env.AUDIO_UPLOAD_MAX_BYTES} bytes`,
        };
      }

      const uploadId = randomUUID();
      const chunkSize = env.AUDIO_UPLOAD_CHUNK_BYTES;
      const totalChunks = Math.max(1, Math.ceil(body.sizeBytes / chunkSize));
      const createdAt = nowIso();
      const chunksDir = await ensureUploadDir(uploadId);

      const session: AudioUploadSession = {
        id: uploadId,
        uploaderId: user.id,
        fileName: body.fileName,
        mimeType: body.mimeType ?? "application/octet-stream",
        sizeBytes: body.sizeBytes,
        chunkSize,
        totalChunks,
        receivedChunks: [],
        status: "uploading",
        chunksDir,
        createdAt,
        updatedAt: createdAt,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      await audioUploadSessionsCollection.insertOne(session as AudioUploadSessionDocument);

      set.status = 201;
      return {
        uploadId,
        chunkSize,
        totalChunks,
        maxBytes: env.AUDIO_UPLOAD_MAX_BYTES,
      };
    },
    {
      auth: true,
      body: audioUploadCreateSchema,
      response: {
        201: audioUploadCreateResponseSchema,
        403: errorSchema,
        413: errorSchema,
      },
      detail: {
        summary: "Create audio upload session",
        tags: ["Media"],
      },
    },
  )
  .put(
    "/uploads/:uploadId/chunks/:index",
    async ({ params, request, user, set }) => {
      if (!verifyPublisher(user.role)) {
        set.status = 403;
        return { message: "only publishers can upload audio" };
      }

      const session = await audioUploadSessionsCollection.findOne({ id: params.uploadId });

      if (!session) {
        set.status = 404;
        return { message: "upload session not found" };
      }

      if (session.uploaderId !== user.id) {
        set.status = 403;
        return { message: "upload session belongs to another user" };
      }

      if (session.status !== "uploading") {
        set.status = 409;
        return { message: "upload session is not accepting chunks" };
      }

      const index = params.index;
      if (index < 0 || index >= session.totalChunks) {
        set.status = 400;
        return { message: "chunk index out of bounds" };
      }

      const contentType = request.headers.get("content-type") ?? "";
      if (contentType && !contentType.includes("application/octet-stream")) {
        set.status = 415;
        return { message: "content-type must be application/octet-stream" };
      }

      const raw = Buffer.from(await request.arrayBuffer());
      if (!raw.byteLength) {
        set.status = 400;
        return { message: "chunk body is empty" };
      }

      const expectedSize = getExpectedChunkSize(session, index);
      if (raw.byteLength !== expectedSize) {
        set.status = 400;
        return { message: `invalid chunk size for index ${index}, expected ${expectedSize} bytes` };
      }

      await mkdir(session.chunksDir, { recursive: true });
      await writeFile(chunkPath(session.chunksDir, index), raw);

      const nextReceived = new Set([...(session.receivedChunks ?? []), index]);

      await audioUploadSessionsCollection.updateOne(
        { id: session.id },
        {
          $set: { updatedAt: nowIso() },
          $addToSet: { receivedChunks: index },
        },
      );

      return {
        uploadId: session.id,
        index,
        receivedChunks: nextReceived.size,
        totalChunks: session.totalChunks,
      };
    },
    {
      auth: true,
      params: audioUploadChunkParamsSchema,
      response: {
        200: audioUploadChunkResponseSchema,
        400: errorSchema,
        403: errorSchema,
        404: errorSchema,
        409: errorSchema,
        415: errorSchema,
      },
      detail: {
        summary: "Upload audio chunk",
        tags: ["Media"],
      },
    },
  )
  .post(
    "/uploads/:uploadId/complete",
    async ({ params, user, set }) => {
      if (!verifyPublisher(user.role)) {
        set.status = 403;
        return { message: "only publishers can upload audio" };
      }

      const session = await audioUploadSessionsCollection.findOne({ id: params.uploadId });

      if (!session) {
        set.status = 404;
        return { message: "upload session not found" };
      }

      if (session.uploaderId !== user.id) {
        set.status = 403;
        return { message: "upload session belongs to another user" };
      }

      if (session.assetId) {
        const existing = await audioAssetsCollection.findOne({ id: session.assetId });
        if (existing) {
          set.status = 202;
          return {
            assetId: existing.id,
            status: existing.status,
          };
        }
      }

      if (session.status !== "uploading") {
        set.status = 409;
        return { message: "upload session cannot be completed in current state" };
      }

      const missingChunks: number[] = [];
      for (let i = 0; i < session.totalChunks; i += 1) {
        try {
          await access(chunkPath(session.chunksDir, i), constants.F_OK);
        } catch {
          missingChunks.push(i);
        }
      }

      if (missingChunks.length) {
        set.status = 400;
        return {
          message: `missing uploaded chunks (${missingChunks.slice(0, 10).join(", ")})`,
        };
      }

      const assetId = randomUUID();
      const now = nowIso();

      const asset: AudioAsset = {
        id: assetId,
        uploadId: session.id,
        uploaderId: session.uploaderId,
        originalFileName: session.fileName,
        originalMimeType: session.mimeType,
        sizeBytes: session.sizeBytes,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      };

      await audioAssetsCollection.insertOne(asset as AudioAssetDocument);

      await audioUploadSessionsCollection.updateOne(
        { id: session.id },
        {
          $set: {
            status: "queued",
            assetId,
            completedAt: now,
            updatedAt: now,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      );

      set.status = 202;
      return {
        assetId,
        status: "queued",
      };
    },
    {
      auth: true,
      params: audioUploadCompleteParamsSchema,
      response: {
        202: audioUploadCompleteResponseSchema,
        400: errorSchema,
        403: errorSchema,
        404: errorSchema,
        409: errorSchema,
      },
      detail: {
        summary: "Complete audio upload and enqueue conversion",
        tags: ["Media"],
      },
    },
  )
  .get(
    "/assets/:assetId/status",
    async ({ params, user, set }) => {
      const asset = await audioAssetsCollection.findOne({ id: params.assetId });

      if (!asset) {
        set.status = 404;
        return { message: "audio asset not found" };
      }

      const isOwner = asset.uploaderId === user.id;
      const isPublisher = verifyPublisher(user.role);
      if (!isOwner && !isPublisher) {
        set.status = 403;
        return { message: "access denied for this audio asset" };
      }

      return {
        id: asset.id,
        status: asset.status,
        errorMessage:
          typeof asset.errorMessage === "string" && asset.errorMessage.length > 0
            ? asset.errorMessage
            : undefined,
        playbackUrl:
          asset.status === "ready"
            ? `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/media/audio/assets/${asset.id}/mp3`
            : undefined,
      };
    },
    {
      auth: true,
      params: audioAssetStatusParamsSchema,
      response: {
        200: audioAssetStatusResponseSchema,
        403: errorSchema,
        404: errorSchema,
      },
      detail: {
        summary: "Get audio asset processing status",
        tags: ["Media"],
      },
    },
  )
  .get(
    "/assets/:assetId/mp3",
    async ({ params, request, set }) => {
      const asset = await audioAssetsCollection.findOne({ id: params.assetId });

      if (!asset) {
        set.status = 404;
        return { message: "audio asset not found" };
      }

      if (asset.status !== "ready") {
        set.status = 409;
        return { message: "audio asset is not ready" };
      }

      const filename = asset.storage?.filename || `${asset.id}.mp3`;

      const file = await audioGridFsFilesCollection.findOne(
        { filename },
        { sort: { uploadDate: -1 } },
      );

      if (!file || typeof file.length !== "number") {
        set.status = 404;
        return { message: "audio file not found" };
      }

      const totalSize = file.length;
      const range = parseRange(request.headers.get("range"), totalSize);

      if (!range) {
        set.status = 416;
        set.headers["Accept-Ranges"] = "bytes";
        set.headers["Content-Range"] = `bytes */${totalSize}`;
        return { message: "invalid byte range" };
      }

      const start = range.start;
      const end = range.end;
      const contentLength = end - start + 1;

      const downloadStream = audioGridFsBucket.openDownloadStreamByName(filename, {
        start,
        end: end + 1,
      });

      const headers: Record<string, string> = {
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(contentLength),
      };

      if (range.partial) {
        headers["Content-Range"] = `bytes ${start}-${end}/${totalSize}`;
      }

      return new Response(Readable.toWeb(downloadStream) as ReadableStream, {
        status: range.partial ? 206 : 200,
        headers,
      });
    },
    {
      params: z.object({ assetId: z.string().uuid() }),
      response: {
        404: errorSchema,
        409: errorSchema,
        416: errorSchema,
      },
      detail: {
        summary: "Stream converted MP3 audio by asset id",
        tags: ["Media"],
      },
    },
  );
