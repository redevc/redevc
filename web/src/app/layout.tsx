import type { Metadata } from "next";


import "../../public/styles/globals.css";
import { ProvidersWrapper } from "@/lib/providers";

export const metadata: Metadata = {
  title: "Rede Você",
  description: "Rede Você",
  openGraph: {
    title: "Rede Você",
    description: "Rede Você",
    images: ["/images/redevoce.png"],
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:5117"),

  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body
        className={`antialiased`}
      >
        <ProvidersWrapper>
          {children}
        </ProvidersWrapper>
      </body>
    </html>
  );
}
