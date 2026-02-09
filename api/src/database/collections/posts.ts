import type { WithId } from "mongodb";
import { db } from "../client.js";
import type { Post } from "../../http/schemas/post.js";

export type PostDocument = WithId<Post>;

export const postsCollection = db.collection<PostDocument>("posts");

export const ensurePostIndexes = async () => {
  try {
    await postsCollection.createIndexes([
      { key: { id: 1 }, name: "id_unique", unique: true },
      { key: { slug: 1 }, name: "slug_unique", unique: true },
      { key: { status: 1 }, name: "status_idx" },
      { key: { tags: 1 }, name: "tags_idx" },
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
