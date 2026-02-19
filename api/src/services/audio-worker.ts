import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { open, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import ffmpegStatic from "ffmpeg-static";

import { env } from "../config/env.js";
import {
  audioAssetsCollection,
  audioGridFsBucket,
  audioUploadSessionsCollection,
  type AudioAsset,
} from "../database/collections/audio.js";
import { logger } from "../utils/logger.js";

const nowIso = () => new Date().toISOString();

const resolveFfmpegCandidates = () => {
  const candidates: string[] = [];

  if (env.FFMPEG_PATH?.trim()) {
    candidates.push(env.FFMPEG_PATH.trim());
  }

  const bundledPath = ffmpegStatic as unknown as string | null | undefined;
  if (typeof bundledPath === "string" && bundledPath.trim()) {
    candidates.push(bundledPath.trim());
  }

  candidates.push("ffmpeg");

  return [...new Set(candidates)];
};

const mergeChunks = async (chunksDir: string, totalChunks: number, destinationPath: string) => {
  const output = await open(destinationPath, "w");
  try {
    for (let index = 0; index < totalChunks; index += 1) {
      const chunk = await readFile(path.join(chunksDir, `${index}.part`));
      await output.write(chunk);
    }
  } finally {
    await output.close();
  }
};

const transcodeToMp3 = async (inputPath: string, outputPath: string) => {
  const runFfmpeg = (ffmpegPath: string) =>
    new Promise<void>((resolve, reject) => {
      const command = spawn(
        ffmpegPath,
        [
          "-y",
          "-i",
          inputPath,
          "-vn",
          "-map_metadata",
          "-1",
          "-codec:a",
          "libmp3lame",
          "-b:a",
          "128k",
          outputPath,
        ],
        {
          stdio: ["ignore", "ignore", "pipe"],
        },
      );

      let stderr = "";
      command.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      command.once("error", (error) => {
        reject(error);
      });

      command.once("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(stderr || `ffmpeg exited with code ${code ?? "unknown"}`));
      });
    });

  const candidates = resolveFfmpegCandidates();
  const notFound: string[] = [];

  for (const candidate of candidates) {
    try {
      await runFfmpeg(candidate);
      return;
    } catch (error) {
      const errno = error as NodeJS.ErrnoException;
      if (errno?.code === "ENOENT" || errno?.code === "EACCES") {
        notFound.push(candidate);
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `ffmpeg executable not available. tried: ${notFound.join(", ")}. Set FFMPEG_PATH or install ffmpeg in PATH.`,
  );
};

const uploadOutputToGridFs = async (asset: AudioAsset, outputPath: string) => {
  const filename = `${asset.id}.mp3`;

  const uploadStream = audioGridFsBucket.openUploadStream(filename, {
    metadata: {
      assetId: asset.id,
      uploadId: asset.uploadId,
      uploaderId: asset.uploaderId,
      contentType: "audio/mpeg",
    },
  });

  await pipeline(createReadStream(outputPath), uploadStream);

  const outputStats = await stat(outputPath);

  return {
    filename,
    contentType: "audio/mpeg",
    sizeBytes: outputStats.size,
  };
};

const setAssetFailed = async (assetId: string, message: string) => {
  const now = nowIso();
  await audioAssetsCollection.updateOne(
    { id: assetId },
    {
      $set: {
        status: "failed",
        errorMessage: message,
        updatedAt: now,
      },
    },
  );

  await audioUploadSessionsCollection.updateOne(
    { assetId },
    {
      $set: {
        status: "failed",
        updatedAt: now,
      },
    },
  );
};

const processAsset = async (asset: AudioAsset) => {
  const session = await audioUploadSessionsCollection.findOne({ id: asset.uploadId });

  if (!session) {
    await setAssetFailed(asset.id, "upload session not found");
    return;
  }

  const now = nowIso();
  await audioUploadSessionsCollection.updateOne(
    { id: session.id },
    {
      $set: {
        status: "processing",
        updatedAt: now,
      },
    },
  );

  const mergedPath = path.join(session.chunksDir, `${asset.id}.source`);
  const outputPath = path.join(session.chunksDir, `${asset.id}.mp3`);

  try {
    await mergeChunks(session.chunksDir, session.totalChunks, mergedPath);
    await transcodeToMp3(mergedPath, outputPath);

    const storage = await uploadOutputToGridFs(asset, outputPath);

    const completedAt = nowIso();
    await audioAssetsCollection.updateOne(
      { id: asset.id },
      {
        $set: {
          status: "ready",
          storage,
          updatedAt: completedAt,
        },
        $unset: {
          errorMessage: "",
        },
      },
    );

    await audioUploadSessionsCollection.updateOne(
      { id: session.id },
      {
        $set: {
          status: "ready",
          updatedAt: completedAt,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    );

    logger(`🎧 audio ready: ${asset.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setAssetFailed(asset.id, message);
    logger(`❌ audio failed: ${asset.id} ${message}`);
  } finally {
    await rm(mergedPath, { force: true }).catch(() => undefined);
    await rm(outputPath, { force: true }).catch(() => undefined);
    await rm(session.chunksDir, { recursive: true, force: true }).catch(() => undefined);
  }
};

const claimNextQueuedAsset = async (): Promise<AudioAsset | null> => {
  const candidate = await audioAssetsCollection.findOne(
    { status: "queued" },
    { sort: { createdAt: 1 } },
  );

  if (!candidate) return null;

  const now = nowIso();
  const lock = await audioAssetsCollection.updateOne(
    { id: candidate.id, status: "queued" },
    {
      $set: {
        status: "processing",
        updatedAt: now,
      },
      $unset: {
        errorMessage: "",
      },
    },
  );

  if (!lock.modifiedCount) {
    return null;
  }

  return {
    ...candidate,
    status: "processing",
    updatedAt: now,
    errorMessage: undefined,
  };
};

let started = false;

export const startAudioWorker = () => {
  if (started) return;
  started = true;

  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;

    try {
      while (true) {
        const asset = await claimNextQueuedAsset();
        if (!asset) break;
        await processAsset(asset);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger(`❌ audio worker tick failed: ${message}`);
    } finally {
      running = false;
    }
  };

  void tick();

  setInterval(() => {
    void tick();
  }, env.AUDIO_WORKER_POLL_MS);

  logger(`🎧 audio worker started (poll=${env.AUDIO_WORKER_POLL_MS}ms)`);
};
