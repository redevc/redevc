import { z } from "zod";

export const audioAssetStatusSchema = z.enum(["queued", "processing", "ready", "failed"]);

export const audioUploadCreateSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128).optional(),
  sizeBytes: z.coerce.number().int().positive(),
});

export const audioUploadCreateResponseSchema = z.object({
  uploadId: z.string().uuid(),
  chunkSize: z.number().int().positive(),
  totalChunks: z.number().int().positive(),
  maxBytes: z.number().int().positive(),
});

export const audioUploadChunkParamsSchema = z.object({
  uploadId: z.string().uuid(),
  index: z.coerce.number().int().nonnegative(),
});

export const audioUploadChunkResponseSchema = z.object({
  uploadId: z.string().uuid(),
  index: z.number().int().nonnegative(),
  receivedChunks: z.number().int().nonnegative(),
  totalChunks: z.number().int().positive(),
});

export const audioUploadCompleteParamsSchema = z.object({
  uploadId: z.string().uuid(),
});

export const audioUploadCompleteResponseSchema = z.object({
  assetId: z.string().uuid(),
  status: audioAssetStatusSchema,
});

export const audioAssetStatusParamsSchema = z.object({
  assetId: z.string().uuid(),
});

export const audioAssetStatusResponseSchema = z.object({
  id: z.string().uuid(),
  status: audioAssetStatusSchema,
  errorMessage: z.string().optional(),
  playbackUrl: z.string().url().optional(),
});

export type AudioAssetStatus = z.infer<typeof audioAssetStatusSchema>;
