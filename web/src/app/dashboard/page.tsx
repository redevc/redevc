import type { Metadata } from "next";
import { DashboardClient } from "../_components/dashboard";

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

export default function DashboardPage() {
  return <DashboardClient />;
}
