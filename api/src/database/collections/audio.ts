import { GridFSBucket, type ObjectId, type WithId } from "mongodb";

import { db } from "../client.js";

export type AudioUploadSessionStatus =
  | "uploading"
  | "queued"
  | "processing"
  | "ready"
  | "failed";

export type AudioAssetStatus = "queued" | "processing" | "ready" | "failed";

export type AudioUploadSession = {
  id: string;
  uploaderId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: number[];
  status: AudioUploadSessionStatus;
  assetId?: string;
  chunksDir: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  expiresAt: Date;
};

export type AudioAsset = {
  id: string;
  uploadId: string;
  uploaderId: string;
  originalFileName: string;
  originalMimeType: string;
  sizeBytes: number;
  status: AudioAssetStatus;
  errorMessage?: string;
  storage?: {
    filename: string;
    contentType: string;
    sizeBytes: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type AudioUploadSessionDocument = WithId<AudioUploadSession>;
export type AudioAssetDocument = WithId<AudioAsset>;

type AudioGridFsFile = {
  _id: ObjectId;
  filename: string;
  length: number;
  chunkSize: number;
  uploadDate: Date;
  contentType?: string;
  metadata?: Record<string, unknown>;
};

export const audioUploadSessionsCollection = db.collection<AudioUploadSessionDocument>("audio_upload_sessions");
export const audioAssetsCollection = db.collection<AudioAssetDocument>("audio_assets");

export const audioGridFsBucket = new GridFSBucket(db, {
  bucketName: "audio_mp3",
});

export const audioGridFsFilesCollection = db.collection<AudioGridFsFile>("audio_mp3.files");

export const ensureAudioIndexes = async () => {
  try {
    await Promise.all([
      audioUploadSessionsCollection.createIndexes([
        { key: { id: 1 }, name: "id_unique", unique: true },
        { key: { uploaderId: 1, createdAt: -1 }, name: "uploader_created_idx" },
        { key: { status: 1, updatedAt: -1 }, name: "status_updated_idx" },
        {
          key: { expiresAt: 1 },
          name: "expires_ttl_idx",
          expireAfterSeconds: 0,
        },
      ]),
      audioAssetsCollection.createIndexes([
        { key: { id: 1 }, name: "id_unique", unique: true },
        { key: { uploadId: 1 }, name: "upload_id_unique", unique: true },
        { key: { uploaderId: 1, createdAt: -1 }, name: "uploader_created_idx" },
        { key: { status: 1, updatedAt: -1 }, name: "status_updated_idx" },
        { key: { "storage.filename": 1 }, name: "storage_filename_idx" },
      ]),
      audioGridFsFilesCollection.createIndex(
        { filename: 1, uploadDate: -1 },
        { name: "filename_upload_date_idx" },
      ),
    ]);
  } catch (error: any) {
    if (error?.code === 85 || error?.codeName === "IndexOptionsConflict") {
      return;
    }
    throw error;
  }
};
