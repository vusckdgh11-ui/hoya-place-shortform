import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text")?.trim().slice(0, 200);
  if (!text) return new NextResponse("Missing text", { status: 400 });
  const url = new URL("https://translate.google.com/translate_tts");
  url.searchParams.set("ie", "UTF-8"); url.searchParams.set("client", "tw-ob"); url.searchParams.set("tl", "ko"); url.searchParams.set("q", text);
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) return new NextResponse("TTS unavailable", { status: 502 });
  return new NextResponse(response.body, { headers: { "content-type": response.headers.get("content-type") || "audio/mpeg", "cache-control": "private, max-age=3600" } });
}
