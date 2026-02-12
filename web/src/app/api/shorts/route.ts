import { NextRequest, NextResponse } from "next/server";

const CHANNEL_ID = "UCqYhmiUr56OrPc89yy5RcmA";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

type YoutubeThumbnail = { url: string };

type SearchItem = {
  id?: { videoId?: string } | string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    thumbnails?: Record<string, YoutubeThumbnail>;
  };
};

type VideoDetails = {
  id: string;
  snippet?: { title?: string; publishedAt?: string; thumbnails?: Record<string, YoutubeThumbnail> };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string };
};

type ShortItem = {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  thumbnail: string;
  viewCount: number;
  durationSec: number;
  score: number;
};

const pickThumbnail = (thumbs?: Record<string, YoutubeThumbnail>): string => {
  if (!thumbs) return "";
  const order = ["maxres", "standard", "high", "medium", "default"] as const;
  for (const key of order) {
    const thumb = thumbs[key];
    if (thumb?.url) return thumb.url;
  }
  const first = Object.values(thumbs)[0];
  return first?.url ?? "";
};

const isoDurationToSeconds = (iso?: string): number => {
  if (!iso) return 0;
  const match = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  if (!match) return 0;
  const [, d, h, m, s] = match.map((v) => Number(v || 0));
  return d * 86400 + h * 3600 + m * 60 + s;
};

const fetchSearch = async (order: "date" | "viewCount") => {
  const params = new URLSearchParams({
    part: "snippet",
    channelId: CHANNEL_ID,
    type: "video",
    videoDuration: "short",
    order,
    maxResults: "25",
    key: YOUTUBE_API_KEY!,
  });
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: order === "date" ? 180 : 600 } });
  if (!res.ok) throw new Error(`YouTube search failed (${order}): ${res.status}`);
  const data = (await res.json()) as { items?: SearchItem[] };
  return data.items ?? [];
};

const fetchDetails = async (ids: string[]): Promise<VideoDetails[]> => {
  if (!ids.length) return [];
  const params = new URLSearchParams({
    part: "snippet,contentDetails,statistics",
    id: ids.join(","),
    key: YOUTUBE_API_KEY!,
    maxResults: "50",
  });
  const url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`YouTube videos failed: ${res.status}`);
  const data = (await res.json()) as { items?: VideoDetails[] };
  return data.items ?? [];
};

const buildResponse = (items: VideoDetails[]): ShortItem[] => {
  const now = Date.now();
  const DAY_MS = 86400000;

  return items
    .map((item) => {
      const durationSec = isoDurationToSeconds(item.contentDetails?.duration);
      if (!item.id || durationSec === 0 || durationSec > 75) return null;
      const viewCount = Number(item.statistics?.viewCount || 0);
      const publishedAt = item.snippet?.publishedAt ?? new Date().toISOString();
      const ageDays = Math.max(0, (now - new Date(publishedAt).getTime()) / DAY_MS);
      const recency = Math.exp(-ageDays / 30);
      const pop = Math.log1p(viewCount);
      const score = 0.65 * recency + 0.35 * pop;
      return {
        id: item.id,
        title: item.snippet?.title ?? "Short",
        url: `https://www.youtube.com/shorts/${item.id}`,
        publishedAt,
        thumbnail: pickThumbnail(item.snippet?.thumbnails),
        viewCount,
        durationSec,
        score,
      } as ShortItem;
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score) as ShortItem[];
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  if (!YOUTUBE_API_KEY) {
    return NextResponse.json(
      { message: "YOUTUBE_API_KEY não configurada no servidor." },
      { status: 500 },
    );
  }

  try {
    const [recent, popular] = await Promise.all([fetchSearch("date"), fetchSearch("viewCount")]);

    const ids = Array.from(
      new Set(
        [...recent, ...popular]
          .map((item) => (typeof item.id === "string" ? item.id : item.id?.videoId))
          .filter(Boolean) as string[],
      ),
    );

    const details = await fetchDetails(ids);
    const items = buildResponse(details);

    return NextResponse.json(
      { items, nextPageToken: null },
      {
        status: 200,
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
      },
    );
  } catch (err) {
    console.error("YouTube shorts fetch error", err);
    return NextResponse.json(
      { message: "Erro ao carregar shorts", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
