export type PostStatus = "draft" | "published";

export type Post = {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  authorId: string;
  coverImageUrl?: string;
  tags?: string[];
  status: PostStatus;
  isFeatured?: boolean;
  featuredUntil?: string;
  createdAt: string;
  updatedAt: string;
};
