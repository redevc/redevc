export type NewsStatus = "draft" | "published";

export type News = {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  authorId: string;
  coverImageUrl?: string;
  tags?: string[];
  status: NewsStatus;
  isFeatured?: boolean;
  featuredUntil?: string;
  views: number;
  createdAt: string;
  updatedAt: string;
};
