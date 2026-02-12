export type ApiComment = {
  id: string;
  newsId: string;
  threadId: string;
  replyTo?: string | null;
  message: string;
  name: string;
  email?: string;
  site?: string;
  userId?: string;
  userImage?: string | null;
  createdAt: string;
};
