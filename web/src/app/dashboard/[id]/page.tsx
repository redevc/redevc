import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isPublisherRole } from "@/utils/roles";

import { AdminDashboardClient } from "../../_components/dashboard/admin";
import { UserDashboardClient } from "../../_components/dashboard/user";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

type Params = Promise<{ id: string }>;

type UserResponse = {
  id: string;
  role?: string | null;
};

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

const fetchUserById = async (id: string): Promise<UserResponse | null> => {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/users/${encodeURIComponent(id)}`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as UserResponse;
  } catch {
    return null;
  }
};

export default async function DashboardByIdPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await fetchUserById(id);
  if (!user) return notFound();

  return isPublisherRole(user.role) ? <AdminDashboardClient /> : <UserDashboardClient />;
}
