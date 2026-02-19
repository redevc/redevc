import type { WithId } from "mongodb";
import { db } from "../client.js";
import type { News } from "../../http/schemas/news.js";

export type NewsDocument = WithId<News>;

export const newsCollection = db.collection<NewsDocument>("news");

export const ensureNewsIndexes = async () => {
  try {
    await newsCollection.createIndexes([
      { key: { id: 1 }, name: "id_unique", unique: true },
      { key: { slug: 1 }, name: "slug_unique", unique: true },
      { key: { status: 1 }, name: "status_idx" },
      { key: { views: -1 }, name: "views_idx" },
      { key: { tags: 1 }, name: "tags_idx" },
      { key: { status: 1, authorId: 1, createdAt: -1 }, name: "status_author_created_idx" },
      { key: { status: 1, views: -1, createdAt: -1 }, name: "status_views_created_idx" },
      {
        key: { title: "text", description: "text", tags: "text" },
        name: "text_search",
        weights: { title: 5, description: 3, tags: 2 },
        default_language: "portuguese",
      },
    ]);
  } catch (error: any) {
    // MongoDB throws code 85 when the same spec exists under a different name.
    if (error?.code === 85 || error?.codeName === "IndexOptionsConflict") {
      return;
    }
    throw error;
  }
};
