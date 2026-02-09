import { Elysia } from "elysia";
import { randomUUID } from "crypto";
import type { Filter, Sort } from "mongodb";
import { z } from "zod";

import { betterAuthPlugin } from "../plugins/better-auth.js";
import { auth } from "../../config/auth.js";
import { slugify } from "../../utils/slugify.js";
import {
  postSchema,
  postStatusSchema,
  postCreateSchema,
  postUpdateSchema,
  postQuerySchema,
  type Post,
} from "../schemas/post.js";
import {
  postsCollection,
  ensurePostIndexes,
  type PostDocument,
} from "../../database/collections/posts.js";

await ensurePostIndexes();

const errorSchema = z.object({ message: z.string() });

const stripInternal = (doc: PostDocument | null): Post | null => {
  if (!doc) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = doc;
  return rest;
};

const ensureUniqueSlug = async (title: string) => {
  const baseSlug = slugify(title) || "post";
  let slug = baseSlug;
  let counter = 2;

  while (
    await postsCollection.findOne(
      { slug },
      { projection: { _id: 1 } },
    )
  ) {
    slug = `${baseSlug}-${counter++}`;
  }

  return slug;
};

const nowIso = () => new Date().toISOString();

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type PostSearchResult = Pick<
  Post,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "coverImageUrl"
  | "createdAt"
  | "status"
  | "tags"
>;

export const postsRoutes = new Elysia({ prefix: "/news" })
  .use(betterAuthPlugin)

  .post(
    "/",
    async ({ body, user, set }) => {
      const isAdmin = user.role === "admin";
      if (!isAdmin) {
        set.status = 403;
        return { message: "only admins can create posts" };
      }

      const createdAt = nowIso();

      const post: Post = {
        id: randomUUID(),
        slug: await ensureUniqueSlug(body.title),
        title: body.title,
        description: body.description,
        content: body.content,
        authorId: user.id,
        coverImageUrl: body.coverImageUrl,
        tags: body.tags,
        status: body.status ?? "draft",
        isFeatured: body.isFeatured,
        featuredUntil: body.featuredUntil,
        createdAt,
        updatedAt: createdAt,
      };

      try {
        await postsCollection.insertOne(post as PostDocument);
      } catch (error: any) {
        if (error?.code === 11000) {
          set.status = 409;
          return { message: "slug already exists" };
        }
        throw error;
      }

      set.status = 201;
      return post;
    },
    {
      auth: true,
      body: postCreateSchema,
      response: {
        201: postSchema,
        403: errorSchema,
        409: errorSchema,
      },
      detail: {
        summary: "Create news",
        tags: ["News"],
      },
    },
  )

  .get(
    "/",
    async ({ request, query, set }) => {
      const session = await auth.api.getSession({ headers: request.headers });
      const user = session?.user;

      const filter: Filter<PostDocument> = {};

      if (query.tag) {
        filter.tags = query.tag;
      }

      if (query.featuredOnly) {
        filter.isFeatured = true;
      }

      if (!session || !user) {
        filter.status = "published";
        if (query.authorId) filter.authorId = query.authorId;
      } else {
        const isAdmin = user.role === "admin";

        if (query.status === "draft") {
          // Rascunhos só podem ser vistos pelo próprio autor, mesmo para admins.
          if (query.authorId && query.authorId !== user.id) {
            set.status = 403;
            return { message: "drafts allowed only for owner" };
          }

          filter.status = "draft";
          filter.authorId = user.id;
        } else if (query.status === "published") {
          filter.status = "published";
          if (query.authorId) filter.authorId = query.authorId;
        } else {
          if (query.authorId && query.authorId !== user.id) {
            set.status = 403;
            return { message: "drafts allowed only for owner" };
          }

          filter.$or = [
            {
              status: "published",
              ...(query.authorId ? { authorId: query.authorId } : {}),
            },
            { status: "draft", authorId: user.id },
          ];
        }
      }

      const skip = (query.page - 1) * query.limit;
      const sort: Sort = { createdAt: -1, updatedAt: -1 };

      const [data, total] = await Promise.all([
        postsCollection
          .find(filter)
          .sort(sort)
          .skip(skip)
          .limit(query.limit)
          .project<Post>({ _id: 0 })
          .toArray(),
        postsCollection.countDocuments(filter),
      ]);

      set.headers["x-total-count"] = String(total);
      set.headers["x-page"] = String(query.page);
      set.headers["x-limit"] = String(query.limit);

      return data;
    },
    {
      query: postQuerySchema,
      response: {
        200: z.array(postSchema),
        403: errorSchema,
      },
      detail: {
        summary: "List news",
        tags: ["News"],
      },
    },
  )

  .get(
    "/search",
    async ({ request, query, set }) => {
      const session = await auth.api.getSession({ headers: request.headers });
      const user = session?.user;

      const conditions: Filter<PostDocument>[] = [];

      const regex = new RegExp(escapeRegex(query.q), "i");
      conditions.push({
        $or: [
          { title: regex },
          { description: regex },
          { tags: regex },
        ],
      });

      if (query.featuredOnly) {
        conditions.push({ isFeatured: true });
      }

      if (!session || !user) {
        conditions.push({ status: "published" });
      } else {
        if (query.status === "draft") {
          conditions.push({ status: "draft" }, { authorId: user.id });
        } else if (query.status === "published") {
          conditions.push({ status: "published" });
        } else {
          conditions.push({
            $or: [
              { status: "published" },
              { status: "draft", authorId: user.id },
            ],
          });
        }
      }

      const filter =
        conditions.length === 1 ? conditions[0] : { $and: conditions };

      const sort: Sort = { createdAt: -1 };

      const data = await postsCollection
        .find(filter)
        .sort(sort)
        .limit(query.limit)
        .project<PostSearchResult>({
          _id: 0,
          id: 1,
          slug: 1,
          title: 1,
          description: 1,
          coverImageUrl: 1,
          createdAt: 1,
          status: 1,
          tags: 1,
        })
        .toArray();

      return data;
    },
    {
      query: z.object({
        q: z.string().min(2),
        limit: z.coerce.number().int().positive().max(50).default(10),
        status: postStatusSchema.optional(),
        featuredOnly: z.coerce.boolean().optional(),
      }),
      response: {
        200: z.array(
          postSchema.pick({
            id: true,
            slug: true,
            title: true,
            description: true,
            coverImageUrl: true,
            createdAt: true,
            status: true,
            tags: true,
          }),
        ),
        401: errorSchema,
        403: errorSchema,
      },
      detail: {
        summary: "Search news",
        tags: ["News"],
      },
    },
  )

  .get(
    "/slug/:slug",
    async ({ request, params, set }) => {
      const post = stripInternal(
        await postsCollection.findOne({ slug: params.slug }),
      );

      if (!post) {
        set.status = 404;
        return { message: "post not found" };
      }

      if (post.status === "draft") {
        const session = await auth.api.getSession({ headers: request.headers });
        const user = session?.user;

        if (!session || !user) {
          set.status = 401;
          return { message: "authentication required to view draft" };
        }

        const isOwner = post.authorId === user.id;

        if (!isOwner) {
          set.status = 403;
          return { message: "drafts allowed only for owner" };
        }
      }

      return post;
    },
    {
      params: z.object({ slug: z.string().min(1) }),
      response: {
        200: postSchema,
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
      },
      detail: {
        summary: "Get news by slug",
        tags: ["News"],
      },
    },
  )

  .get(
    "/:id",
    async ({ request, params, set }) => {
      const post = stripInternal(
        await postsCollection.findOne({ id: params.id }),
      );

      if (!post) {
        set.status = 404;
        return { message: "post not found" };
      }

      if (post.status === "draft") {
        const session = await auth.api.getSession({ headers: request.headers });
        const user = session?.user;

        if (!session || !user) {
          set.status = 401;
          return { message: "authentication required to view draft" };
        }

        const isAdmin = user.role === "admin";
        const isOwner = post.authorId === user.id;

        if (!isOwner) {
          set.status = 403;
          return { message: "drafts allowed only for owner" };
        }
      }

      return post;
    },
    {
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: postSchema,
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
      },
      detail: {
        summary: "Get news by id",
        tags: ["News"],
      },
    },
  )

  .put(
    "/:id",
    async ({ params, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "not authenticated" };
      }

      const existing = await postsCollection.findOne({ id: params.id });
      if (!existing) {
        set.status = 404;
        return { message: "post not found" };
      }

      const isOwner = existing.authorId === user.id;
      const isAdmin = user.role === "admin";
      if (!isAdmin && !isOwner) {
        set.status = 403;
        return { message: "only admins or the author can update this post" };
      }

      const nextStatus = body.status ?? existing.status;

      const updated: Partial<Post> = {
        title: body.title ?? existing.title,
        description: body.description ?? existing.description,
        content: body.content ?? existing.content,
        coverImageUrl: body.coverImageUrl ?? existing.coverImageUrl,
        tags: body.tags ?? existing.tags,
        status: nextStatus,
        isFeatured: body.isFeatured ?? existing.isFeatured,
        featuredUntil: body.featuredUntil ?? existing.featuredUntil,
        updatedAt: nowIso(),
      };

      await postsCollection.updateOne(
        { id: params.id },
        { $set: updated },
      );

      const post = stripInternal(
        await postsCollection.findOne({ id: params.id }),
      );

      if (!post) {
        set.status = 500;
        return { message: "post not found after update" };
      }

      return post;
    },
    {
      auth: true,
      params: postSchema.pick({ id: true }),
      body: postUpdateSchema,
      response: {
        200: postSchema,
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        500: errorSchema,
      },
      detail: {
        summary: "Update news",
        tags: ["News"],
      },
    },
  )

  .delete(
    "/:id",
    async ({ params, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "not authenticated" };
      }

      const isAdmin = user.role === "admin";
      const isOwner = (await postsCollection.findOne({ id: params.id }))?.authorId === user.id;
      if (!isAdmin && !isOwner) {
        set.status = 403;
        return { message: "only the author can delete this draft" };
      }

      const result = await postsCollection.deleteOne({ id: params.id });

      if (!result.deletedCount) {
        set.status = 404;
        return { message: "post not found" };
      }

      set.status = 204;
      return;
    },
    {
      auth: true,
      params: postSchema.pick({ id: true }),
      detail: {
        summary: "Delete news",
        tags: ["News"],
      },
      response: {
        204: z.null(),
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
      },
    },
  );
