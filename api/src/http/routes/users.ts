import { Elysia } from "elysia";
import { z } from "zod";

import { db } from "../../database/client.js";
import { betterAuthPlugin } from "../plugins/better-auth.js";
import { isAdminRole } from "../../utils/roles.js";
import { slugify } from "../../utils/slugify.js";

type UserDoc = {
  _id: string;
  id?: string;
  name?: string;
  username?: string;
  image?: string | null;
  role?: string;
};

type ResolvedAuthor = {
  id: string;
  name?: string;
  username?: string;
  image?: string | null;
  role?: string;
  slug: string;
};

type AmbiguousAuthorCandidate = {
  id: string;
  name?: string;
  username?: string;
  slug: string;
};

const usersCollection = db.collection<UserDoc>("user");
const newsCollection = db.collection<{ authorId?: string; status?: string }>("news");

export const usersRoutes = new Elysia({ prefix: "/users" })
  .use(betterAuthPlugin)
  .get(
    "/resolve/:name",
    async ({ params, set }) => {
      const name = slugify(params.name.trim());
      if (!name) {
        set.status = 400;
        return { message: "name is required" };
      }

      const authorIds = (
        await newsCollection.distinct("authorId", { status: "published" })
      )
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim());

      if (!authorIds.length) {
        set.status = 404;
        return { message: "author not found" };
      }

      const users = await usersCollection
        .find(
          { _id: { $in: authorIds } },
          { projection: { _id: 1, name: 1, username: 1, image: 1, role: 1 } },
        )
        .toArray();

      const matches: ResolvedAuthor[] = [];
      for (const user of users) {
        const nameSlug = slugify(user.name?.trim() ?? "");
        const usernameSlug = slugify(user.username?.trim() ?? "");
        const hasNameMatch = !!nameSlug && nameSlug === name;
        const hasUsernameMatch = !!usernameSlug && usernameSlug === name;
        if (!hasNameMatch && !hasUsernameMatch) continue;

        const userSlug = hasNameMatch ? nameSlug : usernameSlug;
        matches.push({
          id: user._id,
          name: user.name,
          username: user.username,
          image: user.image ?? null,
          role: user.role,
          slug: userSlug,
        });
      }

      if (!matches.length) {
        set.status = 404;
        return { message: "author not found" };
      }

      if (matches.length > 1) {
        const candidates: AmbiguousAuthorCandidate[] = matches.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          username: candidate.username,
          slug: candidate.slug,
        }));

        set.status = 409;
        return {
          message: "author name is ambiguous",
          candidates,
        };
      }

      const match = matches[0];
      if (!match) {
        set.status = 404;
        return { message: "author not found" };
      }

      return match;
    },
    {
      detail: {
        summary: "Resolve author by slug name",
        tags: ["User"],
      },
      params: z.object({ name: z.string().min(1) }),
      response: {
        200: z.object({
          id: z.string(),
          name: z.string().optional(),
          username: z.string().optional(),
          image: z.string().nullable().optional(),
          role: z.string().optional(),
          slug: z.string().min(1),
        }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
        409: z.object({
          message: z.string(),
          candidates: z.array(
            z.object({
              id: z.string(),
              name: z.string().optional(),
              username: z.string().optional(),
              slug: z.string().min(1),
            }),
          ),
        }),
      },
    },
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      const id = params.id.trim();
      if (!id) {
        set.status = 400;
        return { message: "id is required" };
      }

      const user = await usersCollection.findOne(
        { _id: id },
        { projection: { _id: 1, name: 1, username: 1, image: 1, role: 1 } },
      );

      if (!user) {
        set.status = 404;
        return { message: "user not found" };
      }

      return {
        id: user._id,
        name: user.name,
        username: user.username,
        image: user.image ?? null,
        role: user.role,
      };
    },
    {
      detail: {
        summary: "Get user by id",
        tags: ["User"],
      },
      params: z.object({ id: z.string().min(1) }),
      response: {
        200: z.object({
          id: z.string(),
          name: z.string().optional(),
          username: z.string().optional(),
          image: z.string().nullable().optional(),
          role: z.string().optional(),
        }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
  );

// update own profile (name, username, image)
usersRoutes.patch(
  "/:id",
  async ({ params, body, user, set }) => {
    const id = params.id.trim();
    if (!id) {
      set.status = 400;
      return { message: "id is required" };
    }

    if (!user) {
      set.status = 401;
      return { message: "not authenticated" };
    }

    const isSelf = user.id === id;
    const isAdmin = isAdminRole(user.role);
    if (!isSelf && !isAdmin) {
      set.status = 403;
      return { message: "forbidden" };
    }

    const update: Partial<UserDoc> = {};
    if (body.name) update.name = body.name.trim();
    if (body.username) update.username = body.username.trim();
    if (body.image !== undefined) update.image = body.image === null ? null : String(body.image);

    if (!Object.keys(update).length) {
      set.status = 400;
      return { message: "no fields to update" };
    }

    await usersCollection.updateOne({ _id: id }, { $set: update });
    return { success: true, id };
  },
  {
    auth: true,
    detail: {
      summary: "Update user profile",
      tags: ["User"],
    },
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      name: z.string().min(2).max(120).optional(),
      username: z.string().min(3).max(32).optional(),
      image: z.string().url().nullable().optional(),
    }),
    response: {
      200: z.object({ success: z.literal(true), id: z.string() }),
      400: z.object({ message: z.string() }),
      401: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
    },
  },
);
