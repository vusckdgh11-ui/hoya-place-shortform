import { NextRequest, NextResponse } from "next/server";

type KakaoPlace = Record<string, string>;

function normalizePlace(row: KakaoPlace) {
  return {
    id: row.id, name: row.place_name, category: row.category_name || "업체",
    address: row.road_address_name || row.address_name, phone: row.phone || "", image: "",
    reviewCount: 0, photoCount: 0, rating: "", x: row.x, y: row.y,
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim();
  if (!query) return NextResponse.json({ places: [] });
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return NextResponse.json({ places: [], error: "KAKAO_API_KEY_NOT_CONFIGURED" }, { status: 503 });
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", query); url.searchParams.set("size", "15");

  try {
    const response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}`, accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`NAVER_${response.status}`);
    const data = await response.json() as { documents?: KakaoPlace[] };
    const places = (data.documents || []).map(normalizePlace).filter((p) => p.id && p.name).slice(0, 12);
    return NextResponse.json({ places, source: "kakao-local" });
  } catch (error) {
    return NextResponse.json({ places: [], error: error instanceof Error ? error.message : "SEARCH_FAILED" }, { status: 502 });
  }
}
