import type { Metadata } from "next";
import { NewsSlugClient } from "../../_components/news/slug";

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

type Params = Promise<{ slug: string }>;

export default async function NewsSlugPage({ params }: { params: Params }) {
  const { slug } = await params;
  return <NewsSlugClient slug={slug} />;
}
