import { NextRequest, NextResponse } from "next/server";

const IMAGE_RE = /https?:\\?\/\\?\/[^"'<>\\ ]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'<>\\ ]*)?/gi;

function clean(value: string) {
  return value.replace(/\\u002F/g, "/").replace(/\\\//g, "/").replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
}

function unique<T>(items: T[]) { return Array.from(new Set(items)); }

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  const name = request.nextUrl.searchParams.get("name")?.trim() || "선택한 가게";
  const category = request.nextUrl.searchParams.get("category")?.trim() || "음식점";
  const fallbackImage = request.nextUrl.searchParams.get("image")?.trim() || "";
  if (!id) return NextResponse.json({ error: "PLACE_ID_REQUIRED" }, { status: 400 });

  const pages = ["home", "menu", "photo", "review/visitor"].map((tab) => `https://pcmap.place.naver.com/restaurant/${encodeURIComponent(id)}/${tab}`);
  try {
    const texts = await Promise.all(pages.map(async (url) => {
      const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36", accept: "text/html", referer: "https://map.naver.com/" }, signal: AbortSignal.timeout(14000) });
      return res.ok ? res.text() : "";
    }));
    const html = texts.join("\n");
    const images = unique([fallbackImage, ...(html.match(IMAGE_RE) ?? []).map(clean)])
      .filter((url) => /^https?:\/\//.test(url) && !/icon|logo|profile|avatar|marker|sprite/i.test(url)).slice(0, 36);
    const menuMatches = Array.from(html.matchAll(/"name"\s*:\s*"([^"\\]{2,40})"[^{}]{0,180}?"price"\s*:\s*"?([0-9,]{3,10})/g));
    const menus = unique(menuMatches.map((m) => `${clean(m[1])}|${m[2]}`)).slice(0, 10).map((row) => { const [menuName, price] = row.split("|"); return { name: menuName, price }; });
    const reviewMatches = Array.from(html.matchAll(/"(?:body|content|reviewText)"\s*:\s*"([^"\\]{8,180})"/g));
    const reviews = unique(reviewMatches.map((m) => clean(m[1]).replace(/\\n/g, " "))).slice(0, 12);
    return NextResponse.json({ id, name, category, images, menus, reviews, source: "naver-place" });
  } catch (error) {
    return NextResponse.json({ id, name, category, images: fallbackImage ? [fallbackImage] : [], menus: [], reviews: [], error: error instanceof Error ? error.message : "DETAIL_FAILED" });
  }
}
