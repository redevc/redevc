import { openapi } from "@elysiajs/openapi";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import z from "zod";

import { env } from "./config/env.js";
import { betterAuthPlugin, OpenAPI } from "./http/plugins/better-auth.js";
import { logger } from "./utils/logger.js";
import { indexRoutes } from "./http/routes/index.js";
import { userRoutes } from "./http/routes/user.js";
import { usersRoutes } from "./http/routes/users.js";
import { aboutRoutes } from "./http/routes/about.js";
import { newsRoutes } from "./http/routes/news.js";
import { commentsRoutes } from "./http/routes/comments.js";
import { Package } from "./config/package.js";

const app = new Elysia({
  name: "REDEVC, API.",
  adapter: node()
})
  .use(
    cors({
      origin: [env.WEB_APP_URL, env.WEB_URL, env.WEB_DEV_URL],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .use(
    openapi({
      mapJsonSchema: {
        zod: z.toJSONSchema,
      },
      documentation: {
        info: {
          title: "REDEVC, API.",
          version: Package.version,
          description: "Principal API for REDEVC, Inc.",
        },
        components: (await OpenAPI.components) as any,
        paths: (await OpenAPI.getPaths()) as any,
        tags: [
          { name: "Default", description: "Default routes" },
          { name: "User", description: "User related routes" },
          {
            name: "Auth system",
            description: "System authentication for users in routes",
          },
          { name: "News", description: "News related routes" },
          { name: "Comments", description: "Comments related routes" },
        ],
      },
    }),
  )
  .use(betterAuthPlugin)
  .use(indexRoutes)
  .use(userRoutes)
  .use(usersRoutes)
  .use(aboutRoutes)
  .use(newsRoutes)
  .use(commentsRoutes)
  .listen({ port: env.DEFAULT_PORT }, (info) => {
    logger(`🔥 api is running at ${info.hostname}:${info.port}`);
  });

export type App = typeof app;
