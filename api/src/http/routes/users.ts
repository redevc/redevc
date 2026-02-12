import { Elysia } from "elysia";
import { z } from "zod";

import { db } from "../../database/client.js";
import { betterAuthPlugin } from "../plugins/better-auth.js";
import { isAdminRole } from "../../utils/roles.js";

type UserDoc = {
  _id: string;
  id?: string;
  name?: string;
  username?: string;
  image?: string | null;
  role?: string;
};

const usersCollection = db.collection<UserDoc>("user");

export const usersRoutes = new Elysia({ prefix: "/users" })
  .use(betterAuthPlugin)
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
