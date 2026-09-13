import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("Missing URL", { status: 400 });
  let url: URL;
  try { url = new URL(raw); } catch { return new NextResponse("Invalid URL", { status: 400 }); }
  if (url.protocol !== "https:" || !/\.(naver\.net|pstatic\.net|naver\.com)$/.test(url.hostname)) return new NextResponse("Host not allowed", { status: 403 });
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0", referer: "https://pcmap.place.naver.com/" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) return new NextResponse("Image unavailable", { status: 502 });
  return new NextResponse(response.body, { headers: { "content-type": response.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=86400" } });
}
