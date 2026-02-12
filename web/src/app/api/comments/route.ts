import { NextResponse } from "next/server";
import type { ApiComment } from "./(types)";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export const revalidate = 0;

export async function GET(req: Request) {
  if (!API_URL) return NextResponse.json({ message: "API URL missing" }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ message: "slug required" }, { status: 400 });

  const upstream = await fetch(`${API_URL}/news/slug/${encodeURIComponent(slug)}`);
  if (!upstream.ok) {
    return NextResponse.json({ message: "news not found" }, { status: 404 });
  }
  const news = (await upstream.json()) as { id: string };

  const res = await fetch(`${API_URL}/news/${news.id}/comments`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    credentials: "include",
  });

  const data = (await res.json()) as ApiComment[];
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: Request) {
  if (!API_URL) return NextResponse.json({ message: "API URL missing" }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ message: "slug required" }, { status: 400 });

  const upstream = await fetch(`${API_URL}/news/slug/${encodeURIComponent(slug)}`);
  if (!upstream.ok) {
    return NextResponse.json({ message: "news not found" }, { status: 404 });
  }
  const news = (await upstream.json()) as { id: string };

  const body = await req.json();
  const res = await fetch(`${API_URL}/news/${news.id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });

  const data = (await res.json()) as ApiComment;
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(req: Request) {
  if (!API_URL) return NextResponse.json({ message: "API URL missing" }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const commentId = searchParams.get("commentId");
  if (!slug || !commentId) return NextResponse.json({ message: "slug and commentId required" }, { status: 400 });

  const upstream = await fetch(`${API_URL}/news/slug/${encodeURIComponent(slug)}`);
  if (!upstream.ok) {
    return NextResponse.json({ message: "news not found" }, { status: 404 });
  }
  const news = (await upstream.json()) as { id: string };

  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${API_URL}/news/${news.id}/comments/${commentId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
