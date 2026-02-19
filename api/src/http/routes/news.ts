import { Elysia } from "elysia";
import { randomUUID } from "crypto";
import type { Filter, Sort } from "mongodb";
import { z } from "zod";

import { betterAuthPlugin } from "../plugins/better-auth.js";
import { auth } from "../../config/auth.js";
import { slugify } from "../../utils/slugify.js";
import { isPublisherRole } from "../../utils/roles.js";
import {
  newsSchema,
  newsStatusSchema,
  newsCreateSchema,
  newsUpdateSchema,
  newsQuerySchema,
  type News,
} from "../schemas/news.js";
import {
  newsCollection,
  ensureNewsIndexes,
  type NewsDocument,
} from "../../database/collections/news.js";
await ensureNewsIndexes();

const errorSchema = z.object({ message: z.string() });

const stripInternal = (doc: NewsDocument | null): News | null => {
  if (!doc) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = doc;
  return rest;
};

const ensureUniqueSlug = async (title: string) => {
  const baseSlug = slugify(title) || "news";
  let slug = baseSlug;
  let counter = 2;

  while (
    await newsCollection.findOne(
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

type NewsSearchResult = Pick<
  News,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "coverImageUrl"
  | "createdAt"
  | "status"
  | "tags"
  | "views"
>;

export const newsRoutes = new Elysia({ prefix: "/news" })
  .use(betterAuthPlugin)

  .post(
    "/",
    async ({ body, user, set }) => {
      const isPublisher = isPublisherRole(user.role);
      if (!isPublisher) {
        set.status = 403;
        return { message: "only publishers can create news" };
      }

      const createdAt = nowIso();

      const news: News = {
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
        views: 0,
        createdAt,
        updatedAt: createdAt,
      };

      try {
        await newsCollection.insertOne(news as NewsDocument);
      } catch (error: any) {
        if (error?.code === 11000) {
          set.status = 409;
          return { message: "slug already exists" };
        }
        throw error;
      }

      set.status = 201;
      return news;
    },
    {
      auth: true,
      body: newsCreateSchema,
      response: {
        201: newsSchema,
        403: errorSchema,
        409: errorSchema,
      },
      detail: {
        summary: "Create news",
        tags: ["News"],
      },
    },
  )

  // Comentários
  .post(
    "/slug/:slug/view",
    async ({ request, params, set }) => {
      const news = await newsCollection.findOne({ slug: params.slug });

      if (!news) {
        set.status = 404;
        return { message: "news not found" };
      }

      if (news.status === "draft") {
        const session = await auth.api.getSession({ headers: request.headers });
        const user = session?.user;

        if (!session || !user) {
          set.status = 401;
          return { message: "authentication required to view draft" };
        }

        const isOwner = news.authorId === user.id;

        if (!isOwner) {
          set.status = 403;
          return { message: "drafts allowed only for owner" };
        }
      }

      await newsCollection.updateOne({ slug: params.slug }, { $inc: { views: 1 } });

      const updated = await newsCollection.findOne(
        { slug: params.slug },
        { projection: { _id: 0, views: 1 } },
      );

      if (!updated) {
        set.status = 500;
        return { message: "news not found after update" };
      }

      return { views: updated.views ?? 0 };
    },
    {
      params: z.object({ slug: z.string().min(1) }),
      response: {
        200: z.object({ views: z.number().int().nonnegative() }),
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        500: errorSchema,
      },
      detail: {
        summary: "Increment news views by slug",
        tags: ["News"],
      },
    },
  )

  .get(
    "/",
    async ({ request, query, set }) => {
      const session = await auth.api.getSession({ headers: request.headers });
      const user = session?.user;

      const filter: Filter<NewsDocument> = {};

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
      const sort: Sort =
        query.sortBy === "views"
          ? { views: -1, createdAt: -1, updatedAt: -1 }
          : { createdAt: -1, updatedAt: -1 };

      const [data, total] = await Promise.all([
        newsCollection
          .find(filter)
          .sort(sort)
          .skip(skip)
          .limit(query.limit)
          .project<News>({ _id: 0 })
          .toArray(),
        newsCollection.countDocuments(filter),
      ]);

      set.headers["x-total-count"] = String(total);
      set.headers["x-page"] = String(query.page);
      set.headers["x-limit"] = String(query.limit);

      return data;
    },
    {
      query: newsQuerySchema,
      response: {
        200: z.array(newsSchema),
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

      const conditions: Filter<NewsDocument>[] = [];

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

      const data = await newsCollection
        .find(filter)
        .sort(sort)
        .limit(query.limit)
        .project<NewsSearchResult>({
          _id: 0,
          id: 1,
          slug: 1,
          title: 1,
          description: 1,
          coverImageUrl: 1,
          createdAt: 1,
          status: 1,
          tags: 1,
          views: 1,
        })
        .toArray();

      return data;
    },
    {
      query: z.object({
        q: z.string().min(2),
        limit: z.coerce.number().int().positive().max(50).default(10),
        status: newsStatusSchema.optional(),
        featuredOnly: z.coerce.boolean().optional(),
      }),
      response: {
        200: z.array(
          newsSchema.pick({
            id: true,
            slug: true,
            title: true,
            description: true,
            coverImageUrl: true,
            createdAt: true,
            status: true,
            tags: true,
            views: true,
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
      const news = stripInternal(
        await newsCollection.findOne({ slug: params.slug }),
      );

      if (!news) {
        set.status = 404;
        return { message: "news not found" };
      }

      if (news.status === "draft") {
        const session = await auth.api.getSession({ headers: request.headers });
        const user = session?.user;

        if (!session || !user) {
          set.status = 401;
          return { message: "authentication required to view draft" };
        }

        const isOwner = news.authorId === user.id;

        if (!isOwner) {
          set.status = 403;
          return { message: "drafts allowed only for owner" };
        }
      }

      return news;
    },
    {
      params: z.object({ slug: z.string().min(1) }),
      response: {
        200: newsSchema,
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
      const news = stripInternal(
        await newsCollection.findOne({ id: params.id }),
      );

      if (!news) {
        set.status = 404;
        return { message: "news not found" };
      }

      if (news.status === "draft") {
        const session = await auth.api.getSession({ headers: request.headers });
        const user = session?.user;

        if (!session || !user) {
          set.status = 401;
          return { message: "authentication required to view draft" };
        }

        const isOwner = news.authorId === user.id;

        if (!isOwner) {
          set.status = 403;
          return { message: "drafts allowed only for owner" };
        }
      }

      return news;
    },
    {
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: newsSchema,
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

      const existing = await newsCollection.findOne({ id: params.id });
      if (!existing) {
        set.status = 404;
        return { message: "news not found" };
      }

      const isOwner = existing.authorId === user.id;
      const isPublisher = isPublisherRole(user.role);
      if (!isPublisher && !isOwner) {
        set.status = 403;
        return { message: "only publishers or the author can update this news" };
      }

      const nextStatus = body.status ?? existing.status;

      const updated: Partial<News> = {
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

      await newsCollection.updateOne(
        { id: params.id },
        { $set: updated },
      );

      const news = stripInternal(
        await newsCollection.findOne({ id: params.id }),
      );

      if (!news) {
        set.status = 500;
        return { message: "news not found after update" };
      }

      return news;
    },
    {
      auth: true,
      params: newsSchema.pick({ id: true }),
      body: newsUpdateSchema,
      response: {
        200: newsSchema,
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

      const isPublisher = isPublisherRole(user.role);
      const isOwner = (await newsCollection.findOne({ id: params.id }))?.authorId === user.id;
      if (!isPublisher && !isOwner) {
        set.status = 403;
        return { message: "only publishers or the author can delete this news" };
      }

      const result = await newsCollection.deleteOne({ id: params.id });

      if (!result.deletedCount) {
        set.status = 404;
        return { message: "news not found" };
      }

      set.status = 204;
      return;
    },
    {
      auth: true,
      params: newsSchema.pick({ id: true }),
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
