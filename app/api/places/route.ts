import { NextRequest, NextResponse } from "next/server";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? value as UnknownRecord : {};
}

function normalizePlace(item: unknown) {
  const row = asRecord(item);
  return {
    id: String(row.id ?? row.placeId ?? row.sid ?? ""),
    name: String(row.name ?? row.title ?? "").replace(/<[^>]+>/g, ""),
    category: String(row.category ?? row.categoryName ?? row.categoryFullName ?? "업체"),
    address: String(row.roadAddress ?? row.address ?? row.commonAddress ?? ""),
    phone: String(row.phone ?? row.virtualPhone ?? ""),
    image: String(row.thumUrl ?? row.thumbnail ?? row.imageUrl ?? ""),
    reviewCount: Number(row.reviewCount ?? row.visitorReviewCount ?? 0),
    photoCount: Number(row.photoReviewCount ?? row.photoCount ?? 0),
    rating: String(row.rating ?? ""),
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim();
  if (!query) return NextResponse.json({ places: [] });
  const url = new URL("https://map.naver.com/p/api/search/allSearch");
  url.searchParams.set("query", query);
  url.searchParams.set("type", "all");
  url.searchParams.set("searchCoord", "126.9783882;37.5666103");

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        accept: "application/json, text/plain, */*",
        referer: "https://map.naver.com/",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`NAVER_${response.status}`);
    const data = asRecord(await response.json());
    const result = asRecord(data.result);
    const place = asRecord(result.place);
    const raw = (place.list ?? place.items ?? []) as unknown[];
    const places = raw.map(normalizePlace).filter((p) => p.id && p.name).slice(0, 12);
    return NextResponse.json({ places, source: "naver-place" });
  } catch (error) {
    return NextResponse.json({ places: [], error: error instanceof Error ? error.message : "SEARCH_FAILED" }, { status: 502 });
  }
}
