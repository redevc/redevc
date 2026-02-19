import type { Metadata } from "next";
import { AuthorNameClient } from "../../_components/author/name";

export const metadata: Metadata = {
  title: "Rede Você",
  description: "Rede Você",
  openGraph: {
    title: "Rede Você",
    description: "Rede Você",
    images: ["/images/redevoce.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

type Params = Promise<{ name: string }>;

export default async function AuthorNamePage({ params }: { params: Params }) {
  const { name } = await params;
  return <AuthorNameClient name={name} />;
}
