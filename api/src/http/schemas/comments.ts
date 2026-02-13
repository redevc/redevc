import { z } from "zod";

// Schema base para comentário
export const commentSchema = z.object({
  id: z.string().uuid(),
  newsId: z.string(),
  threadId: z.string().uuid(),
  replyTo: z.string().uuid().nullable().optional(),
  message: z.string().min(1, "Comentário não pode estar vazio"),
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().nullish(),
  site: z.string().nullish(),
  userId: z.string().nullish(),
  userImage: z.string().url().nullish(),
  token: z.string().nullish(),
  createdAt: z.string().datetime(),
});

export type Comment = z.infer<typeof commentSchema>;

// Schema para criar comentário
export const commentCreateSchema = z.object({
  newsId: z.string(),
  replyTo: z.string().uuid().nullable().optional(),
  message: z.string().min(1, "Comentário não pode estar vazio").max(2000, "Comentário muito longo"),
  token: z.string().optional(), // gerar no backend se não houver userId
});

export type CommentCreate = z.infer<typeof commentCreateSchema>;

// Schema para buscar comentários
export const commentQuerySchema = z.object({
  newsId: z.string().optional(),
  threadId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CommentQuery = z.infer<typeof commentQuerySchema>;

// Schema para deletar comentário
export const commentDeleteSchema = z.object({
  token: z.string().optional(), // para visitantes não autenticados
});

export type CommentDelete = z.infer<typeof commentDeleteSchema>;
