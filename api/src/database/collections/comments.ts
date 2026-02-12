import type { Document, WithId } from "mongodb";

import { db } from "../client.js";

export type CommentDocument = WithId<Document> & {
  id: string;
  newsId: string;
  threadId: string;
  replyTo?: string | null;
  message: string;
  name: string;
  email?: string;
  site?: string;
  userId?: string;
  userImage?: string | null;
  token?: string; // token do visitante para permitir deleção do próprio comentário
  createdAt: string;
};

export const commentsCollection = db.collection<CommentDocument>("comments");

export const ensureCommentsIndexes = async () => {
  await Promise.all([
    commentsCollection.createIndex({ newsId: 1, createdAt: 1 }),
    commentsCollection.createIndex({ threadId: 1, createdAt: 1 }),
    commentsCollection.createIndex({ replyTo: 1 }),
    commentsCollection.createIndex({ id: 1 }, { unique: true }),
  ]);
};
