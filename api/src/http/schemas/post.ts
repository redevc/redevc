import { z } from "zod";

export const postStatusSchema = z.enum(["draft", "published"]);

export const postSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  content: z.string().min(1),
  authorId: z.string().min(1),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string().min(1)).optional(),
  status: postStatusSchema,
  isFeatured: z.boolean().optional(),
  featuredUntil: z.string().datetime().nullish(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Post = z.infer<typeof postSchema>;

const optionalDateTime = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().datetime().optional(),
);

export const postCreateSchema = z.object({
  title: z.string().min(4),
  description: z.string().min(8),
  content: z.string().min(16),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string().min(1)).optional(),
  status: postStatusSchema.optional().default("draft"),
  isFeatured: z.boolean().optional(),
  featuredUntil: optionalDateTime,
});

export const postUpdateSchema = z.object({
  title: z.string().min(4).optional(),
  description: z.string().min(8).optional(),
  content: z.string().min(16).optional(),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string().min(1)).optional(),
  status: postStatusSchema.optional(),
  isFeatured: z.boolean().optional(),
  featuredUntil: optionalDateTime,
});

export const postQuerySchema = z.object({
  status: postStatusSchema.optional(),
  tag: z.string().optional(),
  authorId: z.string().optional(),
  featuredOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});
