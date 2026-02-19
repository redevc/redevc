import { z } from "zod";

export const newsStatusSchema = z.enum(["draft", "published"]);
export const newsSortBySchema = z.enum(["recent", "views"]);

export const newsSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  content: z.string().min(1),
  authorId: z.string().min(1),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string().min(1)).optional(),
  status: newsStatusSchema,
  isFeatured: z.boolean().optional(),
  featuredUntil: z.string().datetime().nullish(),
  views: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type News = z.infer<typeof newsSchema>;

const optionalDateTime = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().datetime().optional(),
);

export const newsCreateSchema = z.object({
  title: z.string().min(4),
  description: z.string().min(8),
  content: z.string().min(16),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string().min(1)).optional(),
  status: newsStatusSchema.optional().default("draft"),
  isFeatured: z.boolean().optional(),
  featuredUntil: optionalDateTime,
});

export const newsUpdateSchema = z.object({
  title: z.string().min(4).optional(),
  description: z.string().min(8).optional(),
  content: z.string().min(16).optional(),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string().min(1)).optional(),
  status: newsStatusSchema.optional(),
  isFeatured: z.boolean().optional(),
  featuredUntil: optionalDateTime,
});

export const newsQuerySchema = z.object({
  status: newsStatusSchema.optional(),
  tag: z.string().optional(),
  authorId: z.coerce.string().optional(),
  featuredOnly: z.coerce.boolean().optional(),
  sortBy: newsSortBySchema.optional().default("recent"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});
