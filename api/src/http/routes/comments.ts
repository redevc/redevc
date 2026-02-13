import { Elysia } from "elysia";
import { randomUUID } from "crypto";
import { z } from "zod";

import { betterAuthPlugin } from "../plugins/better-auth.js";
import { auth } from "../../config/auth.js";
import {
  commentSchema,
  commentCreateSchema,
  commentQuerySchema,
  commentDeleteSchema,
  type Comment,
} from "../schemas/comments.js";
import {
  commentsCollection,
  ensureCommentsIndexes,
  type CommentDocument,
} from "../../database/collections/comments.js";

await ensureCommentsIndexes();

const errorSchema = z.object({ message: z.string() });

const stripInternal = (doc: CommentDocument | null): Comment | null => {
  if (!doc) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = doc;
  return rest;
};

const generateGuestToken = () => {
  return randomUUID();
};

export const commentsRoutes = new Elysia({ prefix: "/comments" })
  .use(betterAuthPlugin)
  // GET /comments - buscar comentários
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const { newsId, threadId, limit, offset } = commentQuerySchema.parse(query);

        const filter: any = {};
        if (newsId) filter.newsId = newsId;
        if (threadId) filter.threadId = threadId;

        const comments = await commentsCollection
          .find(filter)
          .sort({ createdAt: 1 })
          .skip(offset)
          .limit(limit)
          .toArray();

        const total = await commentsCollection.countDocuments(filter);

        return {
          data: comments.map(stripInternal).filter((c): c is Comment => c !== null),
          total,
          limit,
          offset,
        };
      } catch (err) {
        console.error("Error fetching comments:", err);
        set.status = 500;
        return { message: "Erro ao buscar comentários" };
      }
    },
    {
      query: commentQuerySchema,
      response: {
        200: z.object({
          data: z.array(commentSchema),
          total: z.number(),
          limit: z.number(),
          offset: z.number(),
        }),
        500: errorSchema,
      },
      detail: {
        summary: "Buscar comentários",
        description: "Busca comentários por newsId ou threadId",
        tags: ["Comments"],
      },
    },
  )
  // POST /comments - criar comentário
  .post(
    "/",
    async ({ body, set, headers }) => {
      try {
        const session = await auth.api.getSession({ headers });
        const user = session?.user;

        // Validar que o usuário está autenticado
        if (!user?.id) {
          set.status = 401;
          return { message: "Usuário não autenticado" };
        }

        const { newsId, replyTo, message } = commentCreateSchema.parse(body);

        const newId = randomUUID();
        let threadId: string = newId;

        // Se é uma resposta, buscar o threadId do comentário pai
        if (replyTo) {
          const parentComment = await commentsCollection.findOne({ id: replyTo });
          if (!parentComment) {
            set.status = 404;
            return { message: "Comentário pai não encontrado" };
          }
          threadId = parentComment.threadId;
        }

        const comment: CommentDocument = {
          _id: newId as any, // MongoDB vai criar um ObjectId real
          id: newId,
          newsId,
          threadId,
          replyTo: replyTo || null,
          message,
          name: user.name || user.email || "Anônimo",
          email: user.email,
          userId: user.id,
          userImage: user.image || null,
          createdAt: new Date().toISOString(),
        };

        await commentsCollection.insertOne(comment);

        return {
          data: stripInternal(comment),
          message: "Comentário criado com sucesso",
        };
      } catch (err) {
        console.error("Error creating comment:", err);
        set.status = 500;
        return { message: "Erro ao criar comentário" };
      }
    },
    {
      body: commentCreateSchema,
      response: {
        200: z.object({
          data: commentSchema,
          message: z.string(),
        }),
        401: errorSchema,
        404: errorSchema,
        500: errorSchema,
      },
      detail: {
        summary: "Criar comentário",
        description: "Cria um novo comentário (requer autenticação)",
        tags: ["Comments"],
      },
    },
  )
  // DELETE /comments/:id - deletar comentário
  .delete(
    "/:id",
    async ({ params, set, headers, body }) => {
      try {
        const { id } = params;
        const session = await auth.api.getSession({ headers });
        const user = session?.user;

        const comment = await commentsCollection.findOne({ id });
        if (!comment) {
          set.status = 404;
          return { message: "Comentário não encontrado" };
        }

        // Verificar permissão - usuário pode deletar próprio comentário ou se tiver token
        const canDelete =
          (user?.id && comment.userId === user.id) ||
          (user?.email && comment.email === user.email) ||
          (body?.token && comment.token === body.token);

        if (!canDelete) {
          set.status = 403;
          return { message: "Sem permissão para deletar este comentário" };
        }

        // Deletar o comentário e todas as respostas (recursivamente)
        const deleteThread = async (commentId: string) => {
          // Buscar todas as respostas
          const replies = await commentsCollection.find({ replyTo: commentId }).toArray();
          
          // Deletar recursivamente
          for (const reply of replies) {
            await deleteThread(reply.id);
          }
          
          // Deletar o comentário atual
          await commentsCollection.deleteOne({ id: commentId });
        };

        await deleteThread(id);

        return {
          message: "Comentário e respostas deletados com sucesso",
        };
      } catch (err) {
        console.error("Error deleting comment:", err);
        set.status = 500;
        return { message: "Erro ao deletar comentário" };
      }
    },
    {
      params: z.object({ id: z.string().uuid() }),
      body: commentDeleteSchema.optional(),
      response: {
        200: z.object({ message: z.string() }),
        403: errorSchema,
        404: errorSchema,
        500: errorSchema,
      },
      detail: {
        summary: "Deletar comentário",
        description: "Deleta um comentário e todas suas respostas (requer ser o autor)",
        tags: ["Comments"],
      },
    },
  );
