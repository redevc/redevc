import { NextRequest, NextResponse } from "next/server";

const CHANNEL_ID = "UCqYhmiUr56OrPc89yy5RcmA";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

type YoutubeThumbnail = {
  url: string;
};

type YoutubeSearchItem = {
  id: { videoId?: string };
  snippet: {
    title: string;
    publishedAt: string;
    thumbnails?: Record<string, YoutubeThumbnail>;
  };
};

type VideoItem = {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  thumbnail: string;
  isLive: boolean;
};

const pickThumbnail = (thumbs?: Record<string, YoutubeThumbnail>): string => {
  if (!thumbs) return "";
  const preferredOrder = ["maxres", "standard", "high", "medium", "default"];
  for (const key of preferredOrder) {
    if (thumbs[key]?.url) return thumbs[key]!.url;
  }
  const first = Object.values(thumbs)[0];
  return first?.url ?? "";
};

const mapItems = (items: YoutubeSearchItem[], isLive: boolean): VideoItem[] =>
  items
    .map((item) => {
      const id = item.id?.videoId;
      if (!id) return null;
      return {
        id,
        title: item.snippet?.title ?? "Vídeo",
        url: `https://www.youtube.com/watch?v=${id}`,
        publishedAt: item.snippet?.publishedAt ?? "",
        thumbnail: pickThumbnail(item.snippet?.thumbnails),
        isLive,
      } as VideoItem;
    })
    .filter(Boolean) as VideoItem[];

export async function GET(req: NextRequest) {
  if (!YOUTUBE_API_KEY) {
    return NextResponse.json(
      { message: "YOUTUBE_API_KEY não configurada no servidor." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const pageToken = searchParams.get("pageToken") ?? "";

  const baseParams = new URLSearchParams({
    part: "snippet",
    channelId: CHANNEL_ID,
    type: "video",
    order: "date",
    maxResults: "25",
    key: YOUTUBE_API_KEY,
  });

  const uploadsUrl = `https://www.googleapis.com/youtube/v3/search?${baseParams.toString()}${
    pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""
  }`;

  // Lives só na primeira página para evitar repetição em paginação.
  const liveUrl =
    !pageToken &&
    `https://www.googleapis.com/youtube/v3/search?${baseParams.toString()}&eventType=live`;

  try {
    const [uploadsRes, liveRes] = await Promise.all([
      fetch(uploadsUrl, { next: { revalidate: 300 } }),
      liveUrl ? fetch(liveUrl, { next: { revalidate: 60 } }) : Promise.resolve(null),
    ]);

    if (!uploadsRes.ok) {
      const text = await uploadsRes.text();
      return NextResponse.json(
        { message: "Falha ao carregar vídeos do YouTube", detail: text || uploadsRes.statusText },
        { status: uploadsRes.status === 429 ? 502 : uploadsRes.status },
      );
    }

    const uploadsJson = (await uploadsRes.json()) as {
      items?: YoutubeSearchItem[];
      nextPageToken?: string;
    };

    let liveItems: VideoItem[] = [];
    if (liveRes && liveRes.ok) {
      const liveJson = (await liveRes.json()) as { items?: YoutubeSearchItem[] };
      liveItems = mapItems(liveJson.items ?? [], true);
    }

    const uploadsItems = mapItems(uploadsJson.items ?? [], false);

    const seen = new Set<string>();
    const combined: VideoItem[] = [];
    [...liveItems, ...uploadsItems].forEach((item) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      combined.push(item);
    });

    return NextResponse.json(
      { items: combined, nextPageToken: uploadsJson.nextPageToken ?? null },
      {
        status: 200,
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
      },
    );
  } catch (err) {
    console.error("YouTube fetch error", err);
    return NextResponse.json(
      { message: "Erro ao comunicar com o YouTube", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
